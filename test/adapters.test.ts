import { describe, expect, it } from 'vitest';

import { fanPercentToRaw, fanRawToPercent, normalizeRawDeviceInfo } from '../src/device/adapters';

const bluePureDeviceInfo = {
  id: '<redacted-blue-pure>',
  configuration: {
    di: {
      name: 'Blue Pure 211i Max',
      hw: 'nb_h_1.0',
    },
    ds: {
      pm2_5: {},
      t: {},
    },
  },
  sensordata: [
    { n: 'pm2_5', v: 1, t: 1779663000 },
    { n: 't', v: 260, t: 1779663000 },
  ],
  states: [
    { n: 'standby', vb: false, t: 1779663000 },
    { n: 'fanspeed', v: 15, t: 1779663000 },
    { n: 'fsp0', v: 35, t: 1779663000 },
    { n: 'brightness', v: 80, t: 1779663000 },
  ],
};

const comfortPureDeviceInfo = {
  id: '<redacted-comfort-pure>',
  configuration: {
    di: {
      name: 'ComfortPure',
      hw: 'cmb3in1',
    },
    ds: {
      h: {},
      t: {},
    },
  },
  sensordata: [],
  states: [
    { n: 'standby', vb: false, t: 1779663000 },
    { n: 'fsp0', v: 37, t: 1779663000 },
    { n: 'heattemp', v: 260, t: 1779663000 },
    { n: 'ecoheattemp', v: 260, t: 1779663000 },
    { n: 'tu', v: 1, t: 1779663000 },
  ],
};

describe('device adapters', () => {
  it('keeps Blue Pure fan writes on fanspeed and ignores REST fsp0 as a control', () => {
    const normalized = normalizeRawDeviceInfo(bluePureDeviceInfo);

    expect(normalized.deviceMetadata.adapterId).toBe('blue-pure-max');
    expect(normalized.deviceMetadata.fanSpeed).toEqual({ attribute: 'fanspeed', rawMax: 91 });
    expect(normalized.controlState.fanspeed).toBe(15);
    expect(normalized.controlState.fsp0).toBeUndefined();
  });

  it('keeps ComfortPure fan writes on fsp0 and does not fake temperature from heat setpoints', () => {
    const normalized = normalizeRawDeviceInfo(comfortPureDeviceInfo);

    expect(normalized.deviceMetadata.adapterId).toBe('comfort-pure-t10i');
    expect(normalized.deviceMetadata.fanSpeed).toEqual({ attribute: 'fsp0', rawMax: 91, rawValues: [11, 37, 64, 91] });
    expect(normalized.controlState.fsp0).toBe(37);
    expect(normalized.sensorState.temperature).toBeUndefined();
    expect(normalized.sensorState.humidity).toBeUndefined();
  });

  it('maps real SenML t sensor data to temperature with an explicit source path', () => {
    const normalized = normalizeRawDeviceInfo({
      ...comfortPureDeviceInfo,
      sensordata: [{ n: 't', v: 260, t: 1779663000 }],
    });

    expect(normalized.sensorState.temperature).toBe(260);
    expect(normalized.deviceMetadata.fieldSources['sensorState.temperature']).toBe('sensordata[n=t].v');
  });

  it('maps Blue Pure Max fan percentages to the HA-proven fanspeed 0-91 scale', () => {
    const normalized = normalizeRawDeviceInfo(bluePureDeviceInfo);
    const spec = normalized.deviceMetadata.fanSpeed!;

    expect(fanPercentToRaw(35, spec)).toBe(32);
    expect(fanRawToPercent(37, spec)).toBe(41);
  });

  it('maps ComfortPure fan percentages to the T10i fsp0 step values', () => {
    const normalized = normalizeRawDeviceInfo(comfortPureDeviceInfo);
    const spec = normalized.deviceMetadata.fanSpeed!;

    expect(fanPercentToRaw(35, spec)).toBe(37);
    expect(fanRawToPercent(37, spec)).toBe(50);
  });
});
