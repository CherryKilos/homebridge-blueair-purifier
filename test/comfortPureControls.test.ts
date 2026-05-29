import { describe, expect, it } from 'vitest';

import { serviceName } from '../src/accessory/homekitNames';
import {
  blueairTemperatureToCelsius,
  booleanStateValue,
  booleanWriteValue,
  celsiusToBlueairSetpoint,
  COMFORT_PURE_DISPLAY_OFF_FLOOR,
  displayBrightnessIsOn,
  displayBrightnessPercentToRaw,
  displayBrightnessToPercent,
  nearestTimerPresetSeconds,
  resolveDisplayBrightnessOffFloor,
  timerDurationSeconds,
  timerRemainingSeconds,
} from '../src/device/comfortPureControls';

describe('ComfortPure safe-control helpers', () => {
  it('sanitizes HomeKit names with unsupported characters', () => {
    expect(serviceName('Blue Pure 311i+ Max', 'Night Mode')).toBe('Blue Pure 311i Plus Max Night Mode');
  });

  it('uses only explicit oscillation state values for boolean controls', () => {
    expect(booleanStateValue({ osc: 1 }, 'osc')).toBe(true);
    expect(booleanStateValue({ osc: 0 }, 'osc')).toBe(false);
    expect(booleanWriteValue({ osc: 0 }, 'osc', true)).toBe(1);
    expect(booleanWriteValue({ osc: false }, 'osc', true)).toBe(true);
  });

  it('maps sleep timer durations to safe presets and calculates remaining time', () => {
    expect(nearestTimerPresetSeconds(40 * 60)).toBe(30 * 60);
    expect(nearestTimerPresetSeconds(90 * 60)).toBe(60 * 60);
    expect(timerDurationSeconds({ timdur: 3700 })).toBe(60 * 60);
    expect(timerRemainingSeconds({ timstate: 1, timdur: 3600, timts: 1000 }, 1900)).toBe(2700);
    expect(timerRemainingSeconds({ timstate: 0, timdur: 3600, timts: 1000 }, 1900)).toBe(0);
  });

  it('keeps ambient temperature separate from heat setpoint conversion', () => {
    expect(blueairTemperatureToCelsius(260)).toBe(26);
    expect(celsiusToBlueairSetpoint(23.5)).toBe(235);
  });

  it('treats the ComfortPure display brightness floor as off', () => {
    expect(displayBrightnessIsOn(0, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(false);
    expect(displayBrightnessIsOn(7, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(false);
    expect(displayBrightnessIsOn(8, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(true);
    expect(displayBrightnessToPercent(7, 100, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(0);
    expect(displayBrightnessToPercent(50, 100, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(50);
    expect(displayBrightnessPercentToRaw(1, 100, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(8);
    expect(displayBrightnessPercentToRaw(50, 100, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(50);
    expect(displayBrightnessPercentToRaw(0, 100, COMFORT_PURE_DISPLAY_OFF_FLOOR)).toBe(0);
  });

  it('resolves ComfortPure display brightness floor with an explicit override', () => {
    expect(resolveDisplayBrightnessOffFloor(undefined, true)).toBe(7);
    expect(resolveDisplayBrightnessOffFloor(undefined, false)).toBe(0);
    expect(resolveDisplayBrightnessOffFloor(3, true)).toBe(3);
  });
});
