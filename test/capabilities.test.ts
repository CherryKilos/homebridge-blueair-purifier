import { describe, expect, it } from 'vitest';

import { BlueAirDevice } from '../src/device/BlueAirDevice';
import {
  inferDeviceCapabilities,
  percentToRaw,
  rawToPercent,
  resolveBrightnessMax,
  resolveFanSpeedMax,
  shouldExposeDetectedService,
  shouldExposeService,
  temperatureToCelsius,
} from '../src/device/capabilities';
import { FullBlueAirDeviceState } from '../src/api/BlueAirAwsApi';

const testDeviceMetadata = {
  adapterId: 'blue-pure-max' as const,
  adapterName: 'Blue Pure Max',
  fanSpeed: {
    attribute: 'fanspeed' as const,
    rawMax: 91,
  },
  brightnessMax: 100,
  fieldSources: {},
  rawSensorNames: [],
  rawStateNames: [],
  dataSourceNames: [],
};

const redactedFixtures = {
  comfortPureT10i: {
    state: {
      brightness: 5,
      childlock: false,
      filterusage: 12,
      fsp0: 37,
      standby: false,
    },
    sensorData: {
      humidity: 43,
      pm2_5: 4,
      pm10: 8,
      temperature: 72,
      voc: 100,
    },
  },
  bluePure211iMax: {
    state: {
      automode: false,
      brightness: 80,
      childlock: false,
      fanspeed: 3,
      filterusage: 20,
      nightmode: false,
      standby: false,
    },
    sensorData: {
      pm1: 1,
      pm2_5: 2,
      pm10: 3,
      temperature: 22,
      voc: 75,
    },
  },
  bluePure311iPlusMax: {
    state: {
      automode: true,
      brightness: 100,
      childlock: true,
      fanspeed: 1,
      filterusage: 5,
      germshield: false,
      nightmode: false,
      standby: false,
    },
    sensorData: {
      humidity: 38,
      pm2_5: 3,
      pm10: 5,
      temperature: 21,
    },
  },
};

describe('temperatureToCelsius', () => {
  it('passes Celsius values through', () => {
    expect(temperatureToCelsius(22, 'celsius')).toBe(22);
    expect(temperatureToCelsius(22, 'auto')).toBe(22);
  });

  it('converts Fahrenheit values when configured or auto-detected', () => {
    expect(temperatureToCelsius(68, 'fahrenheit')).toBe(20);
    expect(temperatureToCelsius(72, 'auto')).toBe(22.2);
  });

  it('normalizes deci-degree sensor values before unit handling', () => {
    expect(temperatureToCelsius(260, 'auto')).toBe(26);
    expect(temperatureToCelsius(720, 'auto')).toBe(22.2);
  });
});

describe('normalization helpers', () => {
  it('maps raw fan speeds to HomeKit percentages and back', () => {
    expect(resolveFanSpeedMax(0, 0)).toBe(3);
    expect(rawToPercent(2, 4)).toBe(50);
    expect(percentToRaw(50, 4)).toBe(2);
    expect(percentToRaw(1, 3)).toBe(1);
  });

  it('maps low-range brightness values to HomeKit percentages and back', () => {
    expect(resolveBrightnessMax(undefined, 4)).toBe(10);
    expect(rawToPercent(5, 10)).toBe(50);
    expect(percentToRaw(50, 10)).toBe(5);
  });
});

describe('capability inference', () => {
  it('detects sensors and controls from redacted personal-device shaped fixtures', () => {
    const t10i = inferDeviceCapabilities(redactedFixtures.comfortPureT10i.state, redactedFixtures.comfortPureT10i.sensorData);
    const pure211 = inferDeviceCapabilities(redactedFixtures.bluePure211iMax.state, redactedFixtures.bluePure211iMax.sensorData);
    const pure311 = inferDeviceCapabilities(redactedFixtures.bluePure311iPlusMax.state, redactedFixtures.bluePure311iPlusMax.sensorData);

    expect(t10i.sensors.humidity).toBe(true);
    expect(t10i.sensors.temperature).toBe(true);
    expect(t10i.controls.brightness).toBe(true);
    expect(t10i.controls.fanSpeed).toBe(true);
    expect(pure211.sensors.pm1).toBe(true);
    expect(pure211.sensors.airQuality).toBe(true);
    expect(pure311.controls.germShield).toBe(true);
  });

  it('allows explicit service disabling to override auto exposure', () => {
    expect(shouldExposeService('humidity', false, true, true, ['humidity'])).toBe(false);
    expect(shouldExposeService('humidity', false, true, true)).toBe(true);
    expect(shouldExposeService('humidity', true, false, false)).toBe(true);
  });

  it('does not expose read-only sensor services when no payload value was detected', () => {
    expect(shouldExposeDetectedService('temperature', true, false, true)).toBe(false);
    expect(shouldExposeDetectedService('temperature', false, true, true)).toBe(true);
  });

  it('does not infer ambient temperature from ComfortPure heat setpoints', () => {
    const capabilities = inferDeviceCapabilities(
      {
        ecoheattemp: 260,
        fsp0: 37,
        heattemp: 260,
        standby: false,
      },
      {},
    );

    expect(capabilities.controls.fanSpeed).toBe(true);
    expect(capabilities.sensors.temperature).toBe(false);
    expect(capabilities.sensors.humidity).toBe(false);
  });
});

describe('BlueAirDevice AQI updates', () => {
  it('recalculates AQI when pm2_5 changes', async () => {
    const device = new BlueAirDevice({
      id: '<redacted-device-1>',
      name: 'Blueair Test',
      controlState: redactedFixtures.bluePure211iMax.state,
      sensorState: {
        pm2_5: 1,
        pm10: 1,
        voc: 1,
      },
      deviceMetadata: testDeviceMetadata,
      state: redactedFixtures.bluePure211iMax.state,
      sensorData: {
        pm2_5: 1,
        pm10: 1,
        voc: 1,
      },
    });
    const updates: Partial<FullBlueAirDeviceState>[] = [];

    device.on('stateUpdated', (changedStates) => updates.push(changedStates));
    device.emit('update', {
      id: device.id,
      name: device.name,
      controlState: redactedFixtures.bluePure211iMax.state,
      sensorState: {
        pm2_5: 40,
        pm10: 1,
        voc: 1,
      },
      deviceMetadata: testDeviceMetadata,
      state: redactedFixtures.bluePure211iMax.state,
      sensorData: {
        pm2_5: 40,
        pm10: 1,
        voc: 1,
      },
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(updates[0].pm2_5).toBe(40);
    expect(updates[0].aqi).toBe(device.sensorData.aqi);
    expect(device.sensorData.aqi).toBeGreaterThan(100);
  });
});
