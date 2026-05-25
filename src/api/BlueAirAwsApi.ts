import { Logger } from 'homebridge';
import { Region } from '../platformUtils';
import GigyaApi from './GigyaApi';
import { BLUEAIR_API_TIMEOUT, BlueAirDeviceStatusResponse, LOGIN_EXPIRATION, getAwsConfig } from './Consts';
import { Mutex } from 'async-mutex';
import type { BlueAirMqttAuth } from './BlueAirMqttTypes';
import { collectSensorReadings, hasSensorData, readingsToSensorData } from './BlueAirSensorData';
import { DeviceAdapterMetadata, normalizeRawDeviceInfo } from '../device/adapters';

export type BlueAirDeviceDiscovery = {
  mac: string;
  'mcu-firmware': string;
  name: string;
  type: string;
  'user-type': string;
  uuid: string;
  'wifi-firmware': string;
};

export type FullBlueAirDeviceState = BlueAirDeviceState & BlueAirDeviceSensorData;

export type BlueAirDeviceState = {
  cfv?: string;
  germshield?: boolean;
  gsnm?: boolean;
  standby?: boolean;
  fanspeed?: number;
  fsp0?: number;
  childlock?: boolean;
  nightmode?: boolean;
  mfv?: string;
  automode?: boolean;
  ofv?: string;
  brightness?: number;
  nmbrightness?: number;
  osc?: boolean | number;
  oscstate?: boolean | number;
  oscdir?: number;
  oscfs?: number;
  timstate?: boolean | number;
  timdur?: number;
  timl?: number;
  timts?: number;
  mainmode?: number;
  heattemp?: number;
  heatfs?: number;
  coolfs?: number;
  heatsubmode?: number;
  coolsubmode?: number;
  apsubmode?: number;
  tu?: number;
  safetyswitch?: boolean;
  filterusage?: number;
  disinfection?: boolean;
  disinftime?: number;
  [key: string]: string | number | boolean | undefined;
};

export type BlueAirDeviceSensorData = {
  fanspeed?: number;
  hcho?: number;
  humidity?: number;
  pm1?: number;
  pm10?: number;
  pm2_5?: number;
  rssi?: number;
  temperature?: number;
  voc?: number;
  [key: string]: string | number | boolean | undefined;
};

export type BlueAirDeviceStatus = {
  id: string;
  name: string;
  controlState: BlueAirDeviceState;
  sensorState: BlueAirDeviceSensorData;
  deviceMetadata: DeviceAdapterMetadata;
  /**
   * Legacy aliases kept for the existing accessory/device code while the plugin
   * transitions to explicit control/sensor state.
   */
  state: BlueAirDeviceState;
  sensorData: BlueAirDeviceSensorData;
};

type BlueAirSetStateBody = {
  n: string;
  v?: number;
  vb?: boolean;
};

type BlueAirLoginResponse = {
  access_token?: string;
  'ba_X-Amz-CustomAuthorizer-Name'?: string;
  'ba_X-Amz-CustomAuthorizer-Signature'?: string;
  'ba_X-Amz-CustomAuthorizer-Token'?: string;
};

export type BlueAirHistoricalTelemetry = {
  raw: unknown;
  sensorData: BlueAirDeviceSensorData;
  state: BlueAirDeviceState;
};

export type BlueAirSensorProbeResult = {
  deviceId: string;
  variant: string;
  ok: boolean;
  sensorData?: BlueAirDeviceSensorData;
  state?: BlueAirDeviceState;
  fieldSources?: Record<string, string>;
  response?: unknown;
  error?: string;
};

const HISTORICAL_TELEMETRY_CACHE_MS = 60 * 1000;
const HISTORICAL_TELEMETRY_DURATION_MS = 10 * 60 * 60 * 1000;
const HISTORICAL_SENSOR_NAMES = ['pm1', 'pm2_5', 'pm10', 'tVOC', 'voc', 'hcho', 'h', 't'];

export default class BlueAirAwsApi {
  private readonly gigyaApi: GigyaApi;

  private last_login: number;

  private mutex: Mutex;

  private accessToken: string;
  private blueAirApiUrl: string;
  private mqttAuthName?: string;
  private mqttAuthSignature?: string;
  private mqttAuthToken?: string;
  private userId?: string;
  private historicalTelemetryCache = new Map<string, { expiresAt: number; telemetry: BlueAirHistoricalTelemetry }>();
  private readonly awsConfig: ReturnType<typeof getAwsConfig>;

  constructor(
    username: string,
    password: string,
    region: Region,
    private readonly logger: Logger,
  ) {
    this.awsConfig = getAwsConfig(region);
    this.blueAirApiUrl = `https://${this.awsConfig.restApiId}.execute-api.${this.awsConfig.awsRegion}.amazonaws.com/prod/c`;

    this.mutex = new Mutex();

    this.logger.debug(`Creating BlueAir API instance with config: ${JSON.stringify(this.awsConfig)} and username: ${username}\
    and region: ${region}`);

    this.gigyaApi = new GigyaApi(username, password, region, logger);

    this.last_login = 0;
    this.accessToken = '';
  }

  async login(): Promise<void> {
    this.logger.debug('Logging in...');

    const { token, secret } = await this.gigyaApi.getGigyaSession();
    const { jwt } = await this.gigyaApi.getGigyaJWT(token, secret);
    const { accessToken, mqttAuthName, mqttAuthSignature, mqttAuthToken, userId } = await this.getAwsAccessToken(jwt);

    this.last_login = Date.now();
    this.accessToken = accessToken;
    this.mqttAuthName = mqttAuthName;
    this.mqttAuthSignature = mqttAuthSignature;
    this.mqttAuthToken = mqttAuthToken;
    this.userId = userId;

    this.logger.debug('Logged in');
  }

  async checkTokenExpiration(): Promise<void> {
    if (LOGIN_EXPIRATION < Date.now() - this.last_login) {
      this.logger.debug('Token expired, logging in again');
      return await this.login();
    }
    return;
  }

  async getDevices(): Promise<BlueAirDeviceDiscovery[]> {
    await this.checkTokenExpiration();

    this.logger.debug('Getting devices...');

    const response = await this.apiCall('/registered-devices', undefined, 'GET');

    if (!response.devices) {
      throw new Error('getDevices error: no devices in response');
    }

    const devices = response.devices as BlueAirDeviceDiscovery[];
    return devices;
  }

  async getDeviceStatus(accountUuid: string, uuids: string[]): Promise<BlueAirDeviceStatus[]> {
    const data = await this.getRawDeviceStatus(accountUuid, uuids);

    const deviceStatuses: BlueAirDeviceStatus[] = data.deviceInfo.map((device) => this.withLegacyAliases(normalizeRawDeviceInfo(device)));

    await Promise.all(
      deviceStatuses.map(async (deviceStatus, index) => {
        if (!this.shouldFetchHistoricalTelemetry(data.deviceInfo[index], deviceStatus.sensorState)) {
          return;
        }

        try {
          const historicalTelemetry = await this.getHistoricalTelemetry(deviceStatus.id);
          if (historicalTelemetry && hasSensorData(historicalTelemetry.sensorData)) {
            deviceStatus.sensorState = {
              ...this.sensorStateOnly(historicalTelemetry.sensorData),
              ...deviceStatus.sensorState,
            };
            deviceStatus.sensorData = deviceStatus.sensorState;
          }
        } catch (error) {
          this.logger.debug(
            `[${deviceStatus.name}] Historical sensor telemetry probe failed: ${error instanceof Error ? error.message : error}`,
          );
        }
      }),
    );

    return deviceStatuses;
  }

  async getRawDeviceStatus(accountUuid: string, uuids: string[]): Promise<BlueAirDeviceStatusResponse> {
    await this.checkTokenExpiration();

    const body = {
      deviceconfigquery: uuids.map((uuid) => ({ id: uuid, r: { r: ['sensors'] } })),
      includestates: true,
      eventsubscription: {
        include: uuids.map((uuid) => ({ filter: { o: `= ${uuid}` } })),
      },
    };
    const data = await this.apiCall<BlueAirDeviceStatusResponse>(`/${accountUuid}/r/initial`, body);

    if (!data.deviceInfo) {
      throw new Error('getDeviceStatus error: no deviceInfo in response');
    }

    return data;
  }

  async setDeviceStatus(uuid: string, state: string, value: number | boolean): Promise<void> {
    await this.checkTokenExpiration();

    // this.logger.debug(`setDeviceStatus: ${uuid} ${state} ${value}`);

    const body: BlueAirSetStateBody = {
      n: state,
    };

    if (typeof value === 'number') {
      body.v = value;
    } else if (typeof value === 'boolean') {
      body.vb = value;
    } else {
      throw new Error(`setDeviceStatus: unknown value type ${typeof value}`);
    }

    // const response = await this.apiCall(`/${uuid}/a/${state}`, body);
    await this.apiCall(`/${uuid}/a/${state}`, body);
    // this.logger.debug(`setDeviceStatus response: ${JSON.stringify(response)}`);
  }

  async getMqttAuth(): Promise<BlueAirMqttAuth | undefined> {
    await this.checkTokenExpiration();

    if (!this.mqttAuthName || !this.mqttAuthSignature || !this.mqttAuthToken) {
      return undefined;
    }

    return {
      broker: this.awsConfig.mqttBroker,
      customAuthorizerName: this.mqttAuthName,
      customAuthorizerSignature: this.mqttAuthSignature,
      customAuthorizerToken: this.mqttAuthToken,
      userId: this.userId,
    };
  }

  async getHistoricalTelemetry(
    deviceId: string,
    durationMs = HISTORICAL_TELEMETRY_DURATION_MS,
  ): Promise<BlueAirHistoricalTelemetry | undefined> {
    await this.checkTokenExpiration();

    if (!this.userId) {
      return undefined;
    }

    const cached = this.historicalTelemetryCache.get(deviceId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.telemetry;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const fromSeconds = Math.floor((Date.now() - durationMs) / 1000);
    const query = new URLSearchParams({
      did: deviceId,
      from: String(fromSeconds),
      to: String(nowSeconds),
    });
    HISTORICAL_SENSOR_NAMES.forEach((sensorName) => query.append('s', sensorName));

    const raw = await this.apiCall<unknown>(`/${this.userId}/r/telemetry/5m/historical?${query.toString()}`, undefined, 'GET');
    const readings = collectSensorReadings(raw);
    const telemetry = {
      raw,
      sensorData: this.sensorStateOnly(readingsToSensorData(readings)),
      state: {},
    };

    this.historicalTelemetryCache.set(deviceId, {
      expiresAt: Date.now() + HISTORICAL_TELEMETRY_CACHE_MS,
      telemetry,
    });

    return telemetry;
  }

  async probeInitialSensorVariants(accountUuid: string, deviceId: string): Promise<BlueAirSensorProbeResult[]> {
    await this.checkTokenExpiration();

    const sensorNames = ['t', 'h', 'pm2_5', 'fsp0'];
    const variants = [
      {
        name: 'current-initial',
        body: {
          deviceconfigquery: [{ id: deviceId, r: { r: ['sensors'] } }],
          includestates: true,
          eventsubscription: {
            include: [{ filter: { o: `= ${deviceId}` } }],
          },
        },
      },
      {
        name: 'explicit-sensor-r-list',
        body: {
          deviceconfigquery: [{ id: deviceId, r: { r: ['sensors', ...sensorNames] } }],
          includestates: true,
        },
      },
      {
        name: 'explicit-sensor-s-list',
        body: {
          deviceconfigquery: [{ id: deviceId, r: { s: sensorNames } }],
          includestates: true,
        },
      },
      {
        name: 'sensorquery-r-list',
        body: {
          sensorquery: [{ id: deviceId, r: { r: sensorNames } }],
          includestates: true,
        },
      },
      {
        name: 'sensordataquery',
        body: {
          deviceconfigquery: [{ id: deviceId, r: { r: ['sensors'] } }],
          sensordataquery: [{ id: deviceId, r: { r: sensorNames } }],
          includestates: true,
        },
      },
    ];

    const results: BlueAirSensorProbeResult[] = [];
    for (const variant of variants) {
      try {
        const response = await this.apiCall<unknown>(`/${accountUuid}/r/initial`, variant.body, 'POST', undefined, 0);
        const deviceInfo = this.extractDeviceInfo(response, deviceId);
        const normalized = deviceInfo ? normalizeRawDeviceInfo(deviceInfo) : undefined;
        results.push({
          deviceId,
          variant: variant.name,
          ok: true,
          sensorData: normalized?.sensorState ?? {},
          state: normalized?.controlState ?? {},
          fieldSources: normalized?.deviceMetadata.fieldSources ?? {},
          response,
        });
      } catch (error) {
        results.push({
          deviceId,
          variant: variant.name,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const telemetry = await this.getHistoricalTelemetry(deviceId);
      results.push({
        deviceId,
        variant: 'historical-telemetry-5m',
        ok: true,
        sensorData: telemetry?.sensorData ?? {},
        state: {},
        response: telemetry?.raw,
      });
    } catch (error) {
      results.push({
        deviceId,
        variant: 'historical-telemetry-5m',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return results;
  }

  private shouldFetchHistoricalTelemetry(
    deviceInfo: BlueAirDeviceStatusResponse['deviceInfo'][number],
    sensorData: BlueAirDeviceSensorData,
  ): boolean {
    if (!this.userId) {
      return false;
    }

    const dataSources = deviceInfo.configuration.ds;
    return Boolean(
      (dataSources?.t && sensorData.temperature === undefined) ||
        (dataSources?.h && sensorData.humidity === undefined) ||
        (dataSources?.pm2_5 && sensorData.pm2_5 === undefined) ||
        (dataSources?.pm10 && sensorData.pm10 === undefined) ||
        (dataSources?.tVOC && sensorData.voc === undefined) ||
        (dataSources?.hcho && sensorData.hcho === undefined),
    );
  }

  private withLegacyAliases(status: Omit<BlueAirDeviceStatus, 'state' | 'sensorData'>): BlueAirDeviceStatus {
    return {
      ...status,
      state: status.controlState,
      sensorData: status.sensorState,
    };
  }

  private sensorStateOnly(sensorData: BlueAirDeviceSensorData): BlueAirDeviceSensorData {
    const readOnlySensorData = { ...sensorData };
    delete readOnlySensorData.fanspeed;
    return readOnlySensorData;
  }

  private extractDeviceInfo(response: unknown, deviceId: string): BlueAirDeviceStatusResponse['deviceInfo'][number] | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const deviceInfo = (response as BlueAirDeviceStatusResponse).deviceInfo;
    if (!Array.isArray(deviceInfo)) {
      return undefined;
    }

    return deviceInfo.find((device) => device.id === deviceId);
  }

  private async getAwsAccessToken(jwt: string): Promise<{
    accessToken: string;
    mqttAuthName?: string;
    mqttAuthSignature?: string;
    mqttAuthToken?: string;
    userId?: string;
  }> {
    this.logger.debug('Getting AWS access token...');

    const response = await this.apiCall<BlueAirLoginResponse>('/login', undefined, 'POST', {
      Authorization: `Bearer ${jwt}`,
      idtoken: jwt,
    });

    if (!response.access_token) {
      throw new Error(`AWS access token error: ${JSON.stringify(response)}`);
    }

    this.logger.debug('AWS access token received');
    return {
      accessToken: response.access_token,
      mqttAuthName: response['ba_X-Amz-CustomAuthorizer-Name'],
      mqttAuthSignature: response['ba_X-Amz-CustomAuthorizer-Signature'],
      mqttAuthToken: response['ba_X-Amz-CustomAuthorizer-Token'],
      userId: this.extractUserId(response.access_token),
    };
  }

  private extractUserId(accessToken: string): string | undefined {
    try {
      const [, encodedPayload] = accessToken.split('.');
      if (!encodedPayload) {
        return undefined;
      }

      const paddedPayload = encodedPayload.padEnd(encodedPayload.length + ((4 - (encodedPayload.length % 4)) % 4), '=');
      const claims = JSON.parse(Buffer.from(paddedPayload, 'base64url').toString('utf8')) as { username?: string };
      return claims.username;
    } catch (error) {
      this.logger.warn(`Failed to extract Blueair user id from access token: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async apiCall<T = any>(url: string, data?: string | object, method = 'POST', headers?: object, retries = 3): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const release = await this.mutex.acquire();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), BLUEAIR_API_TIMEOUT);
      try {
        const response = await fetch(`${this.blueAirApiUrl}${url}`, {
          method: method,
          headers: {
            Accept: '*/*',
            Connection: 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, br',
            Authorization: `Bearer ${this.accessToken}`,
            idtoken: this.accessToken,
            ...headers,
          },
          body: data === undefined ? undefined : JSON.stringify(data),
          signal: controller.signal,
        });
        const json = await response.json();
        if (response.status !== 200) {
          throw new Error(`API call error with status ${response.status}: ${response.statusText}, ${JSON.stringify(json)}`);
        }
        return json as T;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
        release();
      }
    }

    if (lastError instanceof Error && lastError.name === 'AbortError') {
      throw new Error(`API call failed after ${retries + 1} attempt(s) with timeout.`);
    }

    throw new Error(`API call failed after ${retries + 1} attempt(s) with error: ${lastError}`);
  }
}
