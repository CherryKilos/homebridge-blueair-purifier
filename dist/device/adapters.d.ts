import type { BlueAirDeviceStatusResponse } from '../api/Consts';
import type { BlueAirDeviceSensorData, BlueAirDeviceState } from '../api/BlueAirAwsApi';
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
export declare function normalizeRawDeviceInfo(deviceInfo: RawDeviceInfo): NormalizedDeviceStatus;
export declare function fanRawToPercent(rawValue: number | undefined, spec: FanSpeedWriteSpec): number;
export declare function fanPercentToRaw(percentValue: number, spec: FanSpeedWriteSpec): number;
export {};
//# sourceMappingURL=adapters.d.ts.map