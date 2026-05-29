import type { BlueAirDeviceState } from '../api/BlueAirAwsApi';

export const COMFORT_PURE_TIMER_PRESETS_SECONDS = [30 * 60, 60 * 60, 2 * 60 * 60, 4 * 60 * 60];
export const COMFORT_PURE_DISPLAY_OFF_FLOOR = 7;

export const COMFORT_PURE_MAIN_MODE = {
  FAN_ONLY: 0,
  HEAT: 1,
  COOL: 2,
} as const;

export function numericStateValue(state: BlueAirDeviceState, key: string): number | undefined {
  const value = state[key];
  return typeof value === 'number' ? value : undefined;
}

export function booleanStateValue(state: BlueAirDeviceState, key: string): boolean {
  const value = state[key];
  return value === true || value === 1;
}

export function booleanWriteValue(state: BlueAirDeviceState, key: string, enabled: boolean): boolean | number {
  return typeof state[key] === 'number' ? (enabled ? 1 : 0) : enabled;
}

export function nearestTimerPresetSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return COMFORT_PURE_TIMER_PRESETS_SECONDS[1];
  }

  return COMFORT_PURE_TIMER_PRESETS_SECONDS.reduce((closest, preset) =>
    Math.abs(preset - seconds) < Math.abs(closest - seconds) ? preset : closest,
  );
}

export function timerDurationSeconds(state: BlueAirDeviceState): number {
  return nearestTimerPresetSeconds(numericStateValue(state, 'timdur') ?? COMFORT_PURE_TIMER_PRESETS_SECONDS[1]);
}

export function timerRemainingSeconds(state: BlueAirDeviceState, nowSeconds = Math.floor(Date.now() / 1000)): number {
  if (!booleanStateValue(state, 'timstate')) {
    return 0;
  }

  const explicitRemaining = numericStateValue(state, 'timl');
  if (explicitRemaining !== undefined) {
    return Math.max(0, Math.round(explicitRemaining));
  }

  const duration = timerDurationSeconds(state);
  const startedAt = numericStateValue(state, 'timts');
  if (startedAt === undefined || startedAt <= 0) {
    return duration;
  }

  return Math.max(0, Math.round(duration - (nowSeconds - startedAt)));
}

export function displayBrightnessIsOn(value: number | undefined, offFloor = 0): boolean {
  return value !== undefined && value > offFloor;
}

export function displayBrightnessToPercent(value: number | undefined, rawMax: number, offFloor = 0): number {
  if (value === undefined || !displayBrightnessIsOn(value, offFloor) || rawMax <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / rawMax) * 100));
}

export function displayBrightnessPercentToRaw(percentValue: number, rawMax: number, offFloor = 0): number {
  if (percentValue <= 0 || rawMax <= 0) {
    return 0;
  }

  const clampedPercent = Math.min(100, percentValue);
  const rawValue = Math.max(1, Math.round((clampedPercent / 100) * rawMax));
  const minimumOnValue = Math.min(rawMax, Math.max(1, offFloor + 1));
  return Math.min(rawMax, Math.max(minimumOnValue, rawValue));
}

export function resolveDisplayBrightnessOffFloor(configuredValue: number | undefined, isComfortPure: boolean): number {
  if (configuredValue !== undefined && configuredValue >= 0) {
    return configuredValue;
  }

  return isComfortPure ? COMFORT_PURE_DISPLAY_OFF_FLOOR : 0;
}

export function blueairTemperatureToCelsius(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Math.abs(value) > 125 && Math.abs(value) <= 1250 ? value / 10 : value;
}

export function celsiusToBlueairSetpoint(value: number): number {
  return Math.round(value * 10);
}

export function clampClimateSetpoint(value: number): number {
  return Math.min(35, Math.max(10, value));
}
