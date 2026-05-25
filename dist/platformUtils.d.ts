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
export declare enum Region {
    EU = "Default (all other regions)",
    AU = "Australia",
    CN = "China",
    RU = "Russia",
    US = "USA"
}
export declare const defaultConfig: Config;
export declare const defaultDeviceConfig: DeviceConfig;
//# sourceMappingURL=platformUtils.d.ts.map