import { BlueAirDeviceSensorData, BlueAirDeviceState } from '../api/BlueAirAwsApi';
import { DeviceConfig, DisabledService, TemperatureInputUnit } from '../platformUtils';

export type DeviceCapabilities = {
  sensors: {
    airQuality: boolean;
    hcho: boolean;
    humidity: boolean;
    pm1: boolean;
    pm10: boolean;
    pm2_5: boolean;
    temperature: boolean;
    voc: boolean;
  };
  controls: {
    autoMode: boolean;
    brightness: boolean;
    childLock: boolean;
    filterUsage: boolean;
    fanSpeed: boolean;
    germShield: boolean;
    nightMode: boolean;
  };
};

const DEFAULT_FAN_SPEED_MAX = 3;
const LOW_RANGE_BRIGHTNESS_MAX = 10;
const PERCENT_MAX = 100;

function hasValue<T>(value: T | undefined): boolean {
  return value !== undefined;
}

export function inferDeviceCapabilities(state: BlueAirDeviceState, sensorData: BlueAirDeviceSensorData): DeviceCapabilities {
  const hasPm2_5 = hasValue(sensorData.pm2_5);
  const hasPm10 = hasValue(sensorData.pm10);
  const hasVoc = hasValue(sensorData.voc);

  return {
    sensors: {
      airQuality: hasPm2_5 || hasPm10 || hasVoc,
      hcho: hasValue(sensorData.hcho),
      humidity: hasValue(sensorData.humidity),
      pm1: hasValue(sensorData.pm1),
      pm10: hasPm10,
      pm2_5: hasPm2_5,
      temperature: hasValue(sensorData.temperature),
      voc: hasVoc,
    },
    controls: {
      autoMode: hasValue(state.automode),
      brightness: hasValue(state.brightness),
      childLock: hasValue(state.childlock),
      filterUsage: hasValue(state.filterusage),
      fanSpeed: hasValue(state.fanspeed) || hasValue(state.fsp0),
      germShield: hasValue(state.germshield),
      nightMode: hasValue(state.nightmode),
    },
  };
}

export function shouldExposeService(
  service: DisabledService,
  legacyConfigEnabled: boolean,
  capabilityDetected: boolean,
  autoExposeAvailableServices: boolean,
  disabledServices: DisabledService[] = [],
): boolean {
  if (disabledServices.includes(service)) {
    return false;
  }

  return legacyConfigEnabled || (autoExposeAvailableServices && capabilityDetected);
}

export function shouldExposeDetectedService(
  service: DisabledService,
  legacyConfigEnabled: boolean,
  capabilityDetected: boolean,
  autoExposeAvailableServices: boolean,
  disabledServices: DisabledService[] = [],
): boolean {
  return (
    capabilityDetected &&
    shouldExposeService(service, legacyConfigEnabled, capabilityDetected, autoExposeAvailableServices, disabledServices)
  );
}

export function resolveFanSpeedMax(configuredMax?: number, observedMax?: number): number {
  if (configuredMax && configuredMax > 0) {
    return configuredMax;
  }

  if (observedMax && observedMax > 0 && observedMax <= LOW_RANGE_BRIGHTNESS_MAX) {
    return Math.max(observedMax, DEFAULT_FAN_SPEED_MAX);
  }

  if (observedMax && observedMax > LOW_RANGE_BRIGHTNESS_MAX) {
    return PERCENT_MAX;
  }

  return DEFAULT_FAN_SPEED_MAX;
}

export function resolveBrightnessMax(configuredMax?: number, observedMax?: number): number {
  if (configuredMax && configuredMax > 0) {
    return configuredMax;
  }

  if (observedMax && observedMax > 0 && observedMax <= LOW_RANGE_BRIGHTNESS_MAX) {
    return LOW_RANGE_BRIGHTNESS_MAX;
  }

  return PERCENT_MAX;
}

export function rawToPercent(rawValue: number | undefined, rawMax: number): number {
  if (!rawValue || rawValue <= 0 || rawMax <= 0) {
    return 0;
  }

  return Math.min(PERCENT_MAX, Math.round((rawValue / rawMax) * PERCENT_MAX));
}

export function percentToRaw(percentValue: number, rawMax: number): number {
  if (percentValue <= 0 || rawMax <= 0) {
    return 0;
  }

  return Math.max(1, Math.round((Math.min(PERCENT_MAX, percentValue) / PERCENT_MAX) * rawMax));
}

export function temperatureToCelsius(value: number | undefined, inputUnit: TemperatureInputUnit = 'auto'): number {
  if (value === undefined) {
    return 0;
  }

  if (inputUnit === 'celsius') {
    return value;
  }

  if (inputUnit === 'fahrenheit' || value > 45) {
    return Math.round((((value - 32) * 5) / 9) * 10) / 10;
  }

  return value;
}

export function fanSpeedMaxForDevice(config: DeviceConfig, observedMax: number): number {
  return resolveFanSpeedMax(config.fanSpeedMax, observedMax);
}

export function brightnessMaxForDevice(config: DeviceConfig, observedMax: number): number {
  return resolveBrightnessMax(config.brightnessMax, observedMax);
}
