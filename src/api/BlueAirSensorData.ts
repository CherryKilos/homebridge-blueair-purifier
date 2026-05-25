import type { BlueAirDeviceSensorData, BlueAirDeviceState } from './BlueAirAwsApi';

export type BlueAirSensorReading = {
  n?: string;
  t?: number;
  v?: number;
  vb?: boolean;
};

export const BlueAirDeviceSensorDataMap: Record<string, keyof BlueAirDeviceSensorData> = {
  fsp0: 'fanspeed',
  hcho: 'hcho',
  h: 'humidity',
  pm1: 'pm1',
  pm10: 'pm10',
  pm2_: 'pm2_5',
  pm2_5: 'pm2_5',
  rssi: 'rssi',
  t: 'temperature',
  tVOC: 'voc',
  voc: 'voc',
};

const STATE_SENSOR_NAMES = new Set(['fsp0', 'fanspeed']);
const SCALAR_SENSOR_NAMES = new Set(['fanspeed', 'fsp0', 'hcho', 'pm1', 'pm10', 'pm2_', 'pm2_5', 'rssi', 'tVOC', 'voc']);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSensorReading(value: unknown): value is BlueAirSensorReading {
  return isObject(value) && typeof value.n === 'string' && ('v' in value || 'vb' in value);
}

export function collectSensorReadings(value: unknown, key = ''): BlueAirSensorReading[] {
  if (typeof value === 'number' && SCALAR_SENSOR_NAMES.has(key)) {
    return [{ n: key, v: value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'number' && SCALAR_SENSOR_NAMES.has(key)) {
        return [{ n: key, v: entry }];
      }

      if (isObject(entry) && BlueAirDeviceSensorDataMap[key] && typeof entry.v === 'number') {
        return [
          {
            n: key,
            t: typeof entry.t === 'number' ? entry.t : undefined,
            v: entry.v,
          },
        ];
      }

      return collectSensorReadings(entry, key);
    });
  }

  if (!isObject(value)) {
    return [];
  }

  if (BlueAirDeviceSensorDataMap[key] && typeof value.v === 'number') {
    return [
      {
        n: key,
        t: typeof value.t === 'number' ? value.t : undefined,
        v: value.v,
      },
    ];
  }

  if (isSensorReading(value)) {
    return [value];
  }

  const readings: BlueAirSensorReading[] = [];
  for (const [entryKey, entry] of Object.entries(value)) {
    if (entry && typeof entry === 'object') {
      readings.push(...collectSensorReadings(entry, entryKey));
    } else {
      readings.push(...collectSensorReadings(entry, entryKey));
    }
  }

  return readings;
}

export function readingsToSensorData(readings: BlueAirSensorReading[]): BlueAirDeviceSensorData {
  const sensorData: BlueAirDeviceSensorData = {};
  const latestScores = new Map<keyof BlueAirDeviceSensorData, number>();

  readings.forEach((reading, index) => {
    if (!reading.n || typeof reading.v !== 'number') {
      return;
    }

    const key = BlueAirDeviceSensorDataMap[reading.n];
    if (!key) {
      return;
    }

    const score = typeof reading.t === 'number' ? reading.t : index;
    const currentScore = latestScores.get(key);
    if (currentScore === undefined || score >= currentScore) {
      sensorData[key] = reading.v;
      latestScores.set(key, score);
    }
  });

  return sensorData;
}

export function readingsToState(readings: BlueAirSensorReading[]): BlueAirDeviceState {
  return readings.reduce((state, reading) => {
    if (!reading.n || !STATE_SENSOR_NAMES.has(reading.n)) {
      return state;
    }

    if (typeof reading.v === 'number') {
      state[reading.n] = reading.v;
    } else if (typeof reading.vb === 'boolean') {
      state[reading.n] = reading.vb;
    }

    return state;
  }, {} as BlueAirDeviceState);
}

export function hasSensorData(sensorData: BlueAirDeviceSensorData): boolean {
  return Object.keys(sensorData).length > 0;
}
