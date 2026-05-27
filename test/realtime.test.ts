import { describe, expect, it } from 'vitest';

import { collectSensorReadings, readingsToSensorData } from '../src/api/BlueAirSensorData';
import { parseRealtimeMessage, realtimeSubscriptionTopics } from '../src/api/BlueAirRealtimeApi';

describe('Blueair realtime parser', () => {
  it('subscribes only to stable realtime topics', () => {
    expect(realtimeSubscriptionTopics(['<redacted-device-1>'])).toEqual([
      'd/<redacted-device-1>/s/5s',
      '$aws/things/<redacted-device-1>/shadow/update/documents',
    ]);
  });

  it('maps MQTT SenML t/h payloads into normalized sensor data', () => {
    const update = parseRealtimeMessage(
      'd/<redacted-device-1>/s/5s',
      JSON.stringify([
        { n: 't', v: 260, t: 1779663000 },
        { n: 'h', v: 43, t: 1779663000 },
        { n: 'pm2_5', v: 4, t: 1779663000 },
        { n: 'tVOC', v: 80, t: 1779663000 },
        { n: 'hcho', v: 2, t: 1779663000 },
        { n: 'rssi', v: -51, t: 1779663000 },
        { n: 'fsp0', v: 37, t: 1779663000 },
      ]),
    );

    expect(update?.deviceId).toBe('<redacted-device-1>');
    expect(update?.sensorData.temperature).toBe(260);
    expect(update?.sensorData.humidity).toBe(43);
    expect(update?.sensorData.pm2_5).toBe(4);
    expect(update?.sensorData.voc).toBe(80);
    expect(update?.sensorData.hcho).toBe(2);
    expect(update?.sensorData.rssi).toBe(-51);
    expect(update?.sensorData.fanspeed).toBeUndefined();
    expect(update?.sensorData.fsp0).toBeUndefined();
    expect(update?.state).toEqual({});
  });

  it('ignores shadow documents that only contain control state and heat setpoints', () => {
    const update = parseRealtimeMessage(
      '$aws/things/<redacted-device-1>/shadow/update/documents',
      JSON.stringify({
        current: {
          state: {
            reported: {
              fsp0: 37,
              heattemp: 260,
              standby: false,
            },
          },
        },
      }),
    );

    expect(update).toBeUndefined();
  });

  it('maps shadow sensor aliases without emitting writable control state', () => {
    const update = parseRealtimeMessage(
      '$aws/things/<redacted-device-1>/shadow/update/documents',
      JSON.stringify({
        current: {
          state: {
            reported: {
              pm2_: 0,
              standby: false,
            },
          },
        },
      }),
    );

    expect(update?.sensorData.pm2_5).toBe(0);
    expect(update?.state.pm2_).toBeUndefined();
    expect(update?.state.standby).toBeUndefined();
  });
});

describe('Blueair REST telemetry parser', () => {
  it('does not treat SenML timestamps as temperature readings', () => {
    const response = {
      states: [
        { n: 'tu', v: 1, t: 1779662697 },
        { n: 'heattemp', v: 260, t: 1779662697 },
        { n: 'fsp0', v: 37, t: 1779662697 },
      ],
    };

    const sensorData = readingsToSensorData(collectSensorReadings(response));
    expect(sensorData.temperature).toBeUndefined();
    expect(sensorData.fanspeed).toBe(37);
  });

  it('does not treat arbitrary scalar t keys as temperature readings', () => {
    const response = {
      diagnostics: {
        t: 10,
      },
    };

    const sensorData = readingsToSensorData(collectSensorReadings(response));
    expect(sensorData.temperature).toBeUndefined();
  });

  it('extracts t/h sensor readings from nested historical responses', () => {
    const response = {
      data: [
        [
          { n: 't', v: 255, t: 1779660000 },
          { n: 'h', v: 41, t: 1779660000 },
        ],
        [
          { n: 't', v: 260, t: 1779660300 },
          { n: 'h', v: 42, t: 1779660300 },
        ],
      ],
    };

    const sensorData = readingsToSensorData(collectSensorReadings(response));
    expect(sensorData.temperature).toBe(260);
    expect(sensorData.humidity).toBe(42);
  });

  it('extracts keyed historical sensor arrays', () => {
    const response = {
      h: [
        { t: 1779660000, v: 41 },
        { t: 1779660300, v: 42 },
      ],
      t: [
        { t: 1779660000, v: 255 },
        { t: 1779660300, v: 260 },
      ],
    };

    const sensorData = readingsToSensorData(collectSensorReadings(response));
    expect(sensorData.temperature).toBe(260);
    expect(sensorData.humidity).toBe(42);
  });

  it('extracts keyed historical sensor objects', () => {
    const response = {
      h: { t: 1779660300, v: 42 },
      t: { t: 1779660300, v: 260 },
    };

    const sensorData = readingsToSensorData(collectSensorReadings(response));
    expect(sensorData.temperature).toBe(260);
    expect(sensorData.humidity).toBe(42);
  });
});
