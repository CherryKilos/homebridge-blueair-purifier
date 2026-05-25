import { describe, expect, it } from 'vitest';

import { serviceName } from '../src/accessory/homekitNames';
import {
  blueairTemperatureToCelsius,
  booleanStateValue,
  booleanWriteValue,
  celsiusToBlueairSetpoint,
  nearestTimerPresetSeconds,
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
});
