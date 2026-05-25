/* eslint-disable no-console */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { defaultsDeep } from 'lodash';
import type { Logger } from 'homebridge';

import BlueAirAwsApi, { BlueAirDeviceStatus } from '../src/api/BlueAirAwsApi';
import BlueAirRealtimeApi, { BlueAirRealtimeUpdate } from '../src/api/BlueAirRealtimeApi';
import type { BlueAirMqttAuth } from '../src/api/BlueAirMqttTypes';
import { Config, defaultConfig } from '../src/platformUtils';
import { PLATFORM_NAME } from '../src/settings';

type HomebridgeConfig = {
  platforms?: Array<Record<string, unknown>>;
};

const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /password/i,
  /secret/i,
  /session/i,
  /signature/i,
  /token/i,
  /^apiKey$/i,
  /^idtoken$/i,
  /^jwt$/i,
];

const PSEUDONYM_KEY_PATTERNS = [/accountUuid/i, /^id$/i, /^mac$/i, /^uuid$/i, /^userId$/i];
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAC_VALUE_PATTERN = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;
const replacements = new Map<string, string>();

const logger = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
} as Pick<Logger, 'debug' | 'info' | 'warn' | 'error'>;

function homebridgeConfigPath(): string {
  return process.env.BLUEAIR_CONFIG ?? path.join(os.homedir(), '.homebridge', 'config.json');
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function shouldPseudonymize(key: string): boolean {
  return PSEUDONYM_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function pseudonymize(value: string, key: string): string {
  const replacementKey = `${key}:${value}`;
  const existing = replacements.get(replacementKey);
  if (existing) {
    return existing;
  }

  const replacement = `<redacted-${key}-${replacements.size + 1}>`;
  replacements.set(replacementKey, replacement);
  return replacement;
}

function redact(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }

  if (typeof value === 'string') {
    if (isSensitiveKey(key)) {
      return '<redacted>';
    }

    if (EMAIL_VALUE_PATTERN.test(value)) {
      return '<redacted-email>';
    }

    if (UUID_VALUE_PATTERN.test(value)) {
      return pseudonymize(value, key || 'uuid');
    }

    if (MAC_VALUE_PATTERN.test(value)) {
      return pseudonymize(value, key || 'mac');
    }

    if (/serial/i.test(key)) {
      return pseudonymize(value, key);
    }

    if (shouldPseudonymize(key)) {
      return pseudonymize(value, key);
    }
  }

  return value;
}

async function loadPluginConfig(): Promise<Config> {
  const configPath = homebridgeConfigPath();
  const rawConfig = JSON.parse(await fs.readFile(configPath, 'utf8')) as HomebridgeConfig;
  const pluginConfig = rawConfig.platforms?.find((platform) => platform.platform === PLATFORM_NAME);

  if (!pluginConfig) {
    throw new Error(`No "${PLATFORM_NAME}" platform config found in ${configPath}`);
  }

  return defaultsDeep({}, pluginConfig, defaultConfig) as Config;
}

function rawShape(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      firstKeys: value[0] && typeof value[0] === 'object' ? Object.keys(value[0]) : [],
    };
  }

  if (value && typeof value === 'object') {
    return {
      type: 'object',
      keys: Object.keys(value),
    };
  }

  return {
    type: typeof value,
  };
}

function adapterStatusSummary(normalizedStatus: BlueAirDeviceStatus[]) {
  return normalizedStatus.map((device) => ({
    id: device.id,
    name: device.name,
    controlState: device.controlState,
    sensorState: device.sensorState,
    adapter: {
      id: device.deviceMetadata.adapterId,
      name: device.deviceMetadata.adapterName,
      fanSpeed: device.deviceMetadata.fanSpeed,
      displayBrightness: device.deviceMetadata.displayBrightness,
      oscillation: device.deviceMetadata.oscillation,
      sleepTimer: device.deviceMetadata.sleepTimer,
      climate: device.deviceMetadata.climate,
      fieldSources: device.deviceMetadata.fieldSources,
      ignoredFields: device.deviceMetadata.ignoredFields,
    },
    declaredDataSources: device.deviceMetadata.declaredDataSources,
    declaredRealtimeSensors: device.deviceMetadata.declaredRealtimeSensors,
  }));
}

async function captureRealtimeSamples(mqttAuth: BlueAirMqttAuth | undefined, uuids: string[]) {
  const timeoutMs = Number(process.env.BLUEAIR_CAPTURE_REALTIME_MS ?? 8000);
  if (!mqttAuth || !uuids.length || timeoutMs <= 0) {
    return {
      timeoutMs,
      samples: [],
      note: 'Realtime sample capture skipped.',
    };
  }

  return new Promise((resolve) => {
    const samples: unknown[] = [];
    const seenDeviceIds = new Set<string>();
    let done = false;

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      realtimeApi.stop();
      resolve({
        timeoutMs,
        samples,
      });
    };

    const timer = setTimeout(finish, timeoutMs);
    const realtimeApi = new BlueAirRealtimeApi(mqttAuth, uuids, logger as Logger, (update: BlueAirRealtimeUpdate) => {
      if (seenDeviceIds.has(update.deviceId)) {
        return;
      }

      seenDeviceIds.add(update.deviceId);
      samples.push({
        deviceId: update.deviceId,
        sensorData: update.sensorData,
        state: update.state,
        rawShape: rawShape(update.raw),
        raw: update.raw,
      });

      if (seenDeviceIds.size >= uuids.length) {
        finish();
      }
    });
    realtimeApi.start();
  });
}

async function main() {
  const config = await loadPluginConfig();
  if (!config.username || !config.password) {
    throw new Error('Blueair username/password are required in the Homebridge plugin config before capture can run.');
  }

  const api = new BlueAirAwsApi(config.username, config.password, config.region, logger as Logger);
  await api.login();

  const registeredDevices = await api.getDevices();
  const accountUuid = config.accountUuid || registeredDevices[0]?.name;
  const configuredUuids = config.devices.map((device) => device.id).filter(Boolean);
  const uuids = configuredUuids.length ? configuredUuids : registeredDevices.map((device) => device.uuid);

  const rawInitialState = accountUuid && uuids.length ? await api.getRawDeviceStatus(accountUuid, uuids) : undefined;
  const normalizedStatus = accountUuid && uuids.length ? await api.getDeviceStatus(accountUuid, uuids) : [];
  const mqttAuth = await api.getMqttAuth();
  const realtimeSampleSummary = await captureRealtimeSamples(mqttAuth, uuids);
  const sensorProbeResults = [];

  if (accountUuid) {
    for (const uuid of uuids) {
      const results = await api.probeInitialSensorVariants(accountUuid, uuid);
      for (const result of results) {
        const sensorKeys = Object.keys(result.sensorData ?? {});
        const stateKeys = Object.keys(result.state ?? {});
        console.info(
          `[${uuid}] probe ${result.variant}: ${
            result.ok
              ? `sensor keys=${sensorKeys.join(',') || 'none'} state keys=${stateKeys.join(',') || 'none'}`
              : `failed ${result.error}`
          }`,
        );
      }
      sensorProbeResults.push(...results);
    }
  }

  const capture = redact({
    capturedAt: new Date().toISOString(),
    config: {
      region: config.region,
      accountUuid,
      devices: config.devices,
    },
    registeredDevices,
    rawInitialState,
    normalizedStatus,
    adapterStatus: adapterStatusSummary(normalizedStatus),
    mqttAuth,
    realtimeSampleSummary,
    sensorProbeResults,
  });

  const outputDir = path.resolve(process.cwd(), 'fixtures', 'personal');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `blueair-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(capture, null, 2)}\n`);

  console.info(`Wrote redacted Blueair capture to ${outputPath}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
