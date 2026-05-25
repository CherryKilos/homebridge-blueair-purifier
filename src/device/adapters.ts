import type { BlueAirDeviceStatusResponse } from '../api/Consts';
import type { BlueAirDeviceSensorData, BlueAirDeviceState } from '../api/BlueAirAwsApi';
import { BlueAirDeviceSensorDataMap } from '../api/BlueAirSensorData';

export type FanSpeedWriteSpec = {
  attribute: 'fanspeed' | 'fsp0';
  rawMax: number;
  rawValues?: number[];
};

export type DeviceAdapterMetadata = {
  adapterId: 'blue-pure-max' | 'comfort-pure-t10i';
  adapterName: string;
  fanSpeed?: FanSpeedWriteSpec;
  brightnessMax: number;
  fieldSources: Record<string, string>;
  rawSensorNames: string[];
  rawStateNames: string[];
  dataSourceNames: string[];
  hardware?: string;
  sku?: string;
};

export type NormalizedDeviceStatus = {
  id: string;
  name: string;
  controlState: BlueAirDeviceState;
  sensorState: BlueAirDeviceSensorData;
  deviceMetadata: DeviceAdapterMetadata;
};

type RawDeviceInfo = BlueAirDeviceStatusResponse['deviceInfo'][number];

type StateEntry = {
  n: string;
  v?: number;
  vb?: boolean;
};

type SensorEntry = {
  n: string;
  v: number;
};

type DeviceAdapter = {
  id: DeviceAdapterMetadata['adapterId'];
  name: string;
  fanSpeed?: FanSpeedWriteSpec;
  brightnessMax: number;
  controlKeys: Set<string>;
  matches: (deviceInfo: RawDeviceInfo) => boolean;
};

const BLUE_PURE_MAX_ADAPTER: DeviceAdapter = {
  id: 'blue-pure-max',
  name: 'Blue Pure Max',
  fanSpeed: {
    attribute: 'fanspeed',
    rawMax: 91,
  },
  brightnessMax: 100,
  controlKeys: new Set(['automode', 'brightness', 'childlock', 'fanspeed', 'filterusage', 'germshield', 'nightmode', 'online', 'standby']),
  matches: (deviceInfo) => {
    const hardware = hardwareName(deviceInfo);
    return (
      hardware.startsWith('nb_') ||
      hardware.startsWith('high') ||
      hasState(deviceInfo, 'fanspeed') ||
      deviceInfo.configuration.di.name.toLowerCase().includes('blue pure')
    );
  },
};

const COMFORT_PURE_T10I_ADAPTER: DeviceAdapter = {
  id: 'comfort-pure-t10i',
  name: 'ComfortPure 3-in-1 T10i',
  fanSpeed: {
    attribute: 'fsp0',
    rawMax: 91,
    rawValues: [11, 37, 64, 91],
  },
  brightnessMax: 10,
  controlKeys: new Set(['brightness', 'childlock', 'filterusage', 'fsp0', 'online', 'standby']),
  matches: (deviceInfo) =>
    hardwareName(deviceInfo).startsWith('cmb3in1') ||
    deviceInfo.configuration.di.name.toLowerCase().includes('comfort') ||
    (hasState(deviceInfo, 'fsp0') &&
      (hasState(deviceInfo, 'heattemp') || hasState(deviceInfo, 'coolfs') || hasState(deviceInfo, 'heatfs'))),
};

const ADAPTERS = [COMFORT_PURE_T10I_ADAPTER, BLUE_PURE_MAX_ADAPTER];

function hasState(deviceInfo: RawDeviceInfo, name: string): boolean {
  return deviceInfo.states.some((state) => state.n === name);
}

function hardwareName(deviceInfo: RawDeviceInfo): string {
  return typeof deviceInfo.configuration.di.hw === 'string' ? deviceInfo.configuration.di.hw : '';
}

function sku(deviceInfo: RawDeviceInfo): string | undefined {
  return typeof deviceInfo.configuration.di.sku === 'string' ? deviceInfo.configuration.di.sku : undefined;
}

function stateValue(state: StateEntry): string | number | boolean | undefined {
  if (state.v !== undefined) {
    return state.v;
  }

  if (state.vb !== undefined) {
    return state.vb;
  }

  return undefined;
}

function normalizeControlState(
  deviceInfo: RawDeviceInfo,
  adapter: DeviceAdapter,
  fieldSources: Record<string, string>,
): BlueAirDeviceState {
  return deviceInfo.states.reduce((controlState, state) => {
    if (!adapter.controlKeys.has(state.n)) {
      return controlState;
    }

    const value = stateValue(state);
    if (value !== undefined) {
      controlState[state.n] = value;
      fieldSources[`controlState.${state.n}`] = `states[n=${state.n}].${state.v !== undefined ? 'v' : 'vb'}`;
    }

    return controlState;
  }, {} as BlueAirDeviceState);
}

function normalizeSensorState(deviceInfo: RawDeviceInfo, fieldSources: Record<string, string>): BlueAirDeviceSensorData {
  return deviceInfo.sensordata.reduce((sensorState, sensor) => {
    const key = BlueAirDeviceSensorDataMap[sensor.n];
    if (!key || key === 'fanspeed') {
      return sensorState;
    }

    sensorState[key] = sensor.v;
    fieldSources[`sensorState.${key}`] = `sensordata[n=${sensor.n}].v`;
    return sensorState;
  }, {} as BlueAirDeviceSensorData);
}

function selectDeviceAdapter(deviceInfo: RawDeviceInfo): DeviceAdapter {
  return ADAPTERS.find((adapter) => adapter.matches(deviceInfo)) ?? BLUE_PURE_MAX_ADAPTER;
}

export function normalizeRawDeviceInfo(deviceInfo: RawDeviceInfo): NormalizedDeviceStatus {
  const adapter = selectDeviceAdapter(deviceInfo);
  const fieldSources: Record<string, string> = {};
  const controlState = normalizeControlState(deviceInfo, adapter, fieldSources);

  const fanSpeed = adapter.fanSpeed && controlState[adapter.fanSpeed.attribute] !== undefined ? adapter.fanSpeed : undefined;
  const sensorState = normalizeSensorState(deviceInfo, fieldSources);

  return {
    id: deviceInfo.id,
    name: deviceInfo.configuration.di.name,
    controlState,
    sensorState,
    deviceMetadata: {
      adapterId: adapter.id,
      adapterName: adapter.name,
      fanSpeed,
      brightnessMax: adapter.brightnessMax,
      fieldSources,
      rawSensorNames: deviceInfo.sensordata.map((sensor: SensorEntry) => sensor.n),
      rawStateNames: deviceInfo.states.map((state: StateEntry) => state.n),
      dataSourceNames: Object.keys(deviceInfo.configuration.ds ?? {}),
      hardware: hardwareName(deviceInfo) || undefined,
      sku: sku(deviceInfo),
    },
  };
}

export function fanRawToPercent(rawValue: number | undefined, spec: FanSpeedWriteSpec): number {
  if (!rawValue || rawValue <= 0 || spec.rawMax <= 0) {
    return 0;
  }

  if (spec.rawValues?.length) {
    const closestIndex = spec.rawValues.reduce((bestIndex, candidate, index) => {
      return Math.abs(candidate - rawValue) < Math.abs(spec.rawValues![bestIndex] - rawValue) ? index : bestIndex;
    }, 0);
    return Math.round(((closestIndex + 1) / spec.rawValues.length) * 100);
  }

  return Math.min(100, Math.round((rawValue / spec.rawMax) * 100));
}

export function fanPercentToRaw(percentValue: number, spec: FanSpeedWriteSpec): number {
  if (percentValue <= 0 || spec.rawMax <= 0) {
    return 0;
  }

  const clampedPercent = Math.min(100, percentValue);
  if (spec.rawValues?.length) {
    const bucketSize = 100 / spec.rawValues.length;
    const index = Math.min(spec.rawValues.length - 1, Math.max(0, Math.ceil(clampedPercent / bucketSize) - 1));
    return spec.rawValues[index];
  }

  return Math.max(1, Math.round((clampedPercent / 100) * spec.rawMax));
}
