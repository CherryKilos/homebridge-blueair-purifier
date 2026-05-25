export type Config = {
  name: string;
  username: string;
  password: string;
  region: Region;
  accountUuid: string;
  autoExposeAvailableServices: boolean;
  realtimeSensors: 'auto' | 'off';
  sensorProbeEnabled: boolean;
  verboseLogging: boolean;
  uiDebug: boolean;
  pollingInterval: number;
  devices: DeviceConfig[];
};

export type TemperatureInputUnit = 'auto' | 'celsius' | 'fahrenheit';
export type DisabledService = 'led' | 'airQuality' | 'temperature' | 'humidity' | 'germShield' | 'nightMode';

export type DeviceConfig = {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  filterChangeLevel: number;
  temperatureInputUnit: TemperatureInputUnit;
  fanSpeedMax: number;
  brightnessMax: number;
  disabledServices: DisabledService[];
  led: boolean;
  airQualitySensor: boolean;
  co2Sensor: boolean;
  temperatureSensor: boolean;
  humiditySensor: boolean;
  germShield: boolean;
  nightMode: boolean;
};

export enum Region {
  EU = 'Default (all other regions)',
  AU = 'Australia',
  CN = 'China',
  RU = 'Russia',
  US = 'USA',
}

export const defaultConfig: Config = {
  name: 'BlueAir Platform',
  uiDebug: false,
  verboseLogging: false,
  username: '',
  password: '',
  accountUuid: '',
  region: Region.EU,
  autoExposeAvailableServices: true,
  realtimeSensors: 'auto',
  sensorProbeEnabled: false,
  pollingInterval: 15000,
  devices: [],
};

export const defaultDeviceConfig: DeviceConfig = {
  id: '',
  name: '',
  model: '',
  serialNumber: '',
  filterChangeLevel: 90,
  temperatureInputUnit: 'auto',
  fanSpeedMax: 0,
  brightnessMax: 0,
  disabledServices: [],
  led: false,
  airQualitySensor: false,
  co2Sensor: false,
  temperatureSensor: false,
  humiditySensor: false,
  germShield: false,
  nightMode: false,
};
