import type { BlueAirDeviceStatusResponse } from '../api/Consts';
import type { BlueAirDeviceSensorData, BlueAirDeviceState } from '../api/BlueAirAwsApi';
export type FanSpeedWriteSpec = {
    attribute: 'fanspeed' | 'fsp0';
    rawMax: number;
    rawValues?: number[];
};
export type DisplayBrightnessSpec = {
    attribute: 'nmbrightness';
    rawMax: number;
};
export type OscillationSpec = {
    attribute: 'osc';
    stateAttribute: 'oscstate';
    directionAttribute: 'oscdir';
    speedAttribute: 'oscfs';
};
export type SleepTimerSpec = {
    stateAttribute: 'timstate';
    durationAttribute: 'timdur';
    remainingAttribute: 'timl';
    startedAtAttribute: 'timts';
    presetSeconds: number[];
};
export type ComfortPureClimateSpec = {
    modeAttribute: 'mainmode';
    heatSetpointAttribute: 'heattemp';
    heatFanAttribute: 'heatfs';
    coolFanAttribute: 'coolfs';
    fanFanAttribute: 'fsp0';
    heatSubmodeAttribute: 'heatsubmode';
    coolSubmodeAttribute: 'coolsubmode';
    autoPurifySubmodeAttribute: 'apsubmode';
};
export type DeclaredDataSources = {
    dc: string[];
    ds: string[];
    rt1s: string[];
    rt5s: string[];
    rt5m: string[];
    b5m: string[];
};
export type DeviceAdapterMetadata = {
    adapterId: 'blue-pure-max' | 'comfort-pure-t10i';
    adapterName: string;
    fanSpeed?: FanSpeedWriteSpec;
    displayBrightness?: DisplayBrightnessSpec;
    oscillation?: OscillationSpec;
    sleepTimer?: SleepTimerSpec;
    climate?: ComfortPureClimateSpec;
    brightnessMax: number;
    fieldSources: Record<string, string>;
    rawSensorNames: string[];
    rawStateNames: string[];
    dataSourceNames: string[];
    declaredDataSources: DeclaredDataSources;
    declaredRealtimeSensors: string[];
    ignoredFields: string[];
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
export declare function normalizeRawDeviceInfo(deviceInfo: RawDeviceInfo): NormalizedDeviceStatus;
export declare function fanRawToPercent(rawValue: number | undefined, spec: FanSpeedWriteSpec): number;
export declare function fanPercentToRaw(percentValue: number, spec: FanSpeedWriteSpec): number;
export {};
//# sourceMappingURL=adapters.d.ts.map