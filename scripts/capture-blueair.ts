/* eslint-disable no-console */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { defaultsDeep } from 'lodash';
import type { Logger } from 'homebridge';

import BlueAirAwsApi, { BlueAirDeviceStatus } from '../src/api/BlueAirAwsApi';
import BlueAirRealtimeApi, { BlueAirRealtimeUpdate } from '../src/api/BlueAirRealtimeApi';
import type { BlueAirMqttAuth } from '../src/api/BlueAirMqttTypes';
import { Config, DeviceConfig, defaultConfig, defaultDeviceConfig } from '../src/platformUtils';
import { PLATFORM_NAME } from '../src/settings';
import {
  inferDeviceCapabilities,
  shouldExposeDetectedService,
  shouldExposeLedService,
  shouldExposeService,
} from '../src/device/capabilities';
import { displayBrightnessIsOn, displayBrightnessToPercent, resolveDisplayBrightnessOffFloor } from '../src/device/comfortPureControls';

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

  const config = defaultsDeep({}, pluginConfig, defaultConfig) as Config;
  config.devices = (config.devices ?? []).map((device) => defaultsDeep({}, device, defaultDeviceConfig));
  return config;
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

function deviceConfigFor(config: Config, device: BlueAirDeviceStatus): DeviceConfig {
  return config.devices.find((deviceConfig) => deviceConfig.id === device.id) ?? defaultDeviceConfig;
}

function displayBrightnessSummary(device: BlueAirDeviceStatus, deviceConfig: DeviceConfig) {
  if (!device.deviceMetadata.displayBrightness) {
    return undefined;
  }

  const rawValue = typeof device.controlState.nmbrightness === 'number' ? device.controlState.nmbrightness : undefined;
  const rawMax =
    deviceConfig.displayBrightnessMax && deviceConfig.displayBrightnessMax > 0
      ? deviceConfig.displayBrightnessMax
      : device.deviceMetadata.displayBrightness.rawMax;
  const offFloor = resolveDisplayBrightnessOffFloor(
    deviceConfig.displayBrightnessOffFloor,
    device.deviceMetadata.adapterId === 'comfort-pure-t10i',
  );

  return {
    rawValue,
    rawMax,
    offFloor,
    homeKitOn: displayBrightnessIsOn(rawValue, offFloor),
    homeKitBrightness: displayBrightnessToPercent(rawValue, rawMax, offFloor),
  };
}

function exposedHomeKitServices(device: BlueAirDeviceStatus, deviceConfig: DeviceConfig, config: Config): string[] {
  const capabilities = inferDeviceCapabilities(device.controlState, device.sensorState);
  const disabledServices = deviceConfig.disabledServices ?? [];
  const services = ['AirPurifier', 'FilterMaintenance'];

  if (device.deviceMetadata.fanSpeed) {
    services.push('AirPurifier.RotationSpeed');
  }
  if (capabilities.controls.childLock) {
    services.push('AirPurifier.LockPhysicalControls');
  }
  if (device.deviceMetadata.oscillation && !disabledServices.includes('oscillation')) {
    services.push('AirPurifier.SwingMode');
  }
  if (
    shouldExposeLedService(
      deviceConfig.led,
      capabilities.controls.brightness,
      Boolean(device.deviceMetadata.displayBrightness),
      config.autoExposeAvailableServices,
      disabledServices,
    )
  ) {
    services.push('Lightbulb.Led');
  }
  if (device.deviceMetadata.displayBrightness && !disabledServices.includes('displayLight')) {
    services.push('Lightbulb.Display');
  }
  if (
    shouldExposeDetectedService(
      'airQuality',
      deviceConfig.airQualitySensor,
      capabilities.sensors.airQuality,
      config.autoExposeAvailableServices,
      disabledServices,
    )
  ) {
    services.push('AirQualitySensor');
  }
  if (
    shouldExposeDetectedService(
      'temperature',
      deviceConfig.temperatureSensor,
      capabilities.sensors.temperature,
      config.autoExposeAvailableServices,
      disabledServices,
    )
  ) {
    services.push('TemperatureSensor');
  }
  if (
    shouldExposeDetectedService(
      'humidity',
      deviceConfig.humiditySensor,
      capabilities.sensors.humidity,
      config.autoExposeAvailableServices,
      disabledServices,
    )
  ) {
    services.push('HumiditySensor');
  }
  if (
    shouldExposeService(
      'germShield',
      deviceConfig.germShield,
      capabilities.controls.germShield,
      config.autoExposeAvailableServices,
      disabledServices,
    )
  ) {
    services.push('Switch.GermShield');
  }
  if (
    shouldExposeService(
      'nightMode',
      deviceConfig.nightMode,
      capabilities.controls.nightMode,
      config.autoExposeAvailableServices,
      disabledServices,
    )
  ) {
    services.push('Switch.NightMode');
  }
  if (deviceConfig.sleepTimer && device.deviceMetadata.sleepTimer && !disabledServices.includes('sleepTimer')) {
    services.push('Valve.SleepTimer');
  }
  if (
    deviceConfig.comfortPureClimateMode === 'gated' &&
    device.deviceMetadata.climate &&
    device.sensorState.temperature !== undefined &&
    !disabledServices.includes('comfortPureClimate')
  ) {
    services.push('HeaterCooler.ComfortPureClimate');
  }

  return services;
}

function adapterStatusSummary(normalizedStatus: BlueAirDeviceStatus[], config: Config) {
  return normalizedStatus.map((device) => ({
    id: device.id,
    name: device.name,
    controlState: device.controlState,
    sensorState: device.sensorState,
    displayBrightness: displayBrightnessSummary(device, deviceConfigFor(config, device)),
    exposedHomeKitServices: exposedHomeKitServices(device, deviceConfigFor(config, device), config),
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
    adapterStatus: adapterStatusSummary(normalizedStatus, config),
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
