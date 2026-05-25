import type { Logger } from 'homebridge';
import { connect } from 'mqtt';
import type { IClientOptions, MqttClient } from 'mqtt';

import type { BlueAirDeviceSensorData, BlueAirDeviceState } from './BlueAirAwsApi';
import type { BlueAirMqttAuth } from './BlueAirMqttTypes';
import { collectSensorReadings, hasSensorData, readingsToSensorData } from './BlueAirSensorData';

export type BlueAirRealtimeUpdate = {
  deviceId: string;
  sensorData: BlueAirDeviceSensorData;
  state: BlueAirDeviceState;
  raw: unknown;
};

const MAX_EMPTY_CLOSES = 4;
const CLOSE_WINDOW_MS = 60 * 1000;

type WebsocketOptionsWithHeaders = {
  headers?: Record<string, string>;
  [key: string]: unknown;
};

function parseJsonPayload(payload: Buffer | string): unknown | undefined {
  try {
    return JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : payload);
  } catch {
    return undefined;
  }
}

export function parseRealtimeMessage(topic: string, payload: Buffer | string): BlueAirRealtimeUpdate | undefined {
  const raw = parseJsonPayload(payload);
  if (raw === undefined) {
    return undefined;
  }

  const sensorTopicMatch = topic.match(/(?:^|\/)d\/([^/]+)\/s\/(?:1s|5s|5m|batch\/b5m)$/);
  if (sensorTopicMatch) {
    const readings = collectSensorReadings(raw);
    const sensorData = readOnlyRealtimeSensorData(readingsToSensorData(readings));

    if (!hasSensorData(sensorData)) {
      return undefined;
    }

    return {
      deviceId: sensorTopicMatch[1],
      sensorData,
      state: {},
      raw,
    };
  }

  const shadowTopicMatch = topic.match(/^\$aws\/things\/([^/]+)\/shadow\/update\/documents$/);
  if (shadowTopicMatch) {
    const readings = collectSensorReadings(raw);
    const sensorData = readOnlyRealtimeSensorData(readingsToSensorData(readings));
    if (!hasSensorData(sensorData)) {
      return undefined;
    }

    return {
      deviceId: shadowTopicMatch[1],
      sensorData,
      state: {},
      raw,
    };
  }

  return undefined;
}

function readOnlyRealtimeSensorData(sensorData: BlueAirDeviceSensorData): BlueAirDeviceSensorData {
  const readOnlySensorData = { ...sensorData };
  delete readOnlySensorData.fanspeed;
  return readOnlySensorData;
}

export function realtimeSubscriptionTopics(deviceIds: string[]): string[] {
  return deviceIds.flatMap((deviceId) => [`d/${deviceId}/s/5s`, `$aws/things/${deviceId}/shadow/update/documents`]);
}

export default class BlueAirRealtimeApi {
  private client?: MqttClient;
  private resubscribeTimer?: NodeJS.Timeout;
  private closeTimes: number[] = [];
  private messagesReceived = 0;
  private stopping = false;
  private loggedFirstPayloadKeys = new Set<string>();

  constructor(
    private readonly auth: BlueAirMqttAuth,
    private readonly deviceIds: string[],
    private readonly logger: Logger,
    private readonly onUpdate: (update: BlueAirRealtimeUpdate) => void,
    private readonly diagnosticsEnabled = false,
  ) {}

  start(): void {
    if (this.client) {
      return;
    }

    const options: IClientOptions = {
      clientId: `homebridge-blueair-${Date.now()}`,
      clean: true,
      connectTimeout: 30 * 1000,
      keepalive: 60,
      path: '/mqtt',
      protocol: 'wss',
      reconnectPeriod: 5000,
      transformWsUrl: (url, opts) => {
        const wsOptions = (opts.wsOptions ?? {}) as WebsocketOptionsWithHeaders;
        opts.wsOptions = {
          ...wsOptions,
          headers: {
            ...(wsOptions.headers ?? {}),
            'X-Amz-CustomAuthorizer-Name': this.auth.customAuthorizerName,
            'X-Amz-CustomAuthorizer-Signature': this.auth.customAuthorizerSignature,
            'X-Amz-CustomAuthorizer-Token': this.auth.customAuthorizerToken,
          },
        };
        return url;
      },
    };

    this.client = connect(`wss://${this.auth.broker}:443/mqtt`, options);
    this.client.on('connect', () => {
      this.logger.debug('Blueair realtime sensor stream connected');
      this.subscribe();
      this.startResubscribeTimer();
    });
    this.client.on('reconnect', () => this.logger.debug('Blueair realtime sensor stream reconnecting'));
    this.client.on('error', (error) => this.logger.warn(`Blueair realtime sensor stream error: ${error.message}`));
    this.client.on('close', () => this.handleClose());
    this.client.on('message', (topic, payload) => {
      const update = parseRealtimeMessage(topic, payload);
      if (update) {
        this.messagesReceived++;
        this.logFirstPayloadKeys(topic, update);
        this.onUpdate(update);
      }
    });
  }

  stop(): void {
    this.stopping = true;

    if (this.resubscribeTimer) {
      clearInterval(this.resubscribeTimer);
      this.resubscribeTimer = undefined;
    }

    if (this.client) {
      this.client.end(true);
      this.client = undefined;
    }
  }

  private subscribe(): void {
    if (!this.client?.connected) {
      return;
    }

    const topics = realtimeSubscriptionTopics(this.deviceIds);

    this.client.subscribe(topics, { qos: 0 }, (error) => {
      if (error) {
        this.logger.warn(`Blueair realtime sensor subscription failed: ${error.message}`);
      } else {
        this.logger.debug(`Blueair realtime sensor subscription active for ${this.deviceIds.length} device(s)`);
      }
    });
  }

  private startResubscribeTimer(): void {
    if (this.resubscribeTimer) {
      return;
    }

    this.resubscribeTimer = setInterval(() => this.subscribe(), 15 * 60 * 1000);
  }

  private logFirstPayloadKeys(topic: string, update: BlueAirRealtimeUpdate): void {
    if (!this.diagnosticsEnabled || this.loggedFirstPayloadKeys.has(update.deviceId)) {
      return;
    }

    this.loggedFirstPayloadKeys.add(update.deviceId);
    const sensorKeys = Object.keys(update.sensorData).sort();
    const stateKeys = Object.keys(update.state).sort();
    this.logger.debug(
      `[${update.deviceId}] Blueair realtime first payload: topic=${topic}, ` +
        `sensor keys=${sensorKeys.join(',') || 'none'}, state keys=${stateKeys.join(',') || 'none'}`,
    );
  }

  private handleClose(): void {
    if (this.stopping) {
      return;
    }

    this.logger.debug('Blueair realtime sensor stream closed');
    if (this.messagesReceived > 0) {
      this.closeTimes = [];
      return;
    }

    const now = Date.now();
    this.closeTimes = [...this.closeTimes, now].filter((closeTime) => now - closeTime <= CLOSE_WINDOW_MS);
    if (this.closeTimes.length >= MAX_EMPTY_CLOSES) {
      this.logger.warn(
        'Blueair realtime sensor stream closed repeatedly before delivering sensor data. ' +
          'Disabling realtime sensors; REST polling will continue.',
      );
      this.stop();
    }
  }
}
