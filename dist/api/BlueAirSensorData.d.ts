import type { BlueAirDeviceSensorData, BlueAirDeviceState } from './BlueAirAwsApi';
export type BlueAirSensorReading = {
    n?: string;
    t?: number;
    v?: number;
    vb?: boolean;
};
export declare const BlueAirDeviceSensorDataMap: Record<string, keyof BlueAirDeviceSensorData>;
export declare function collectSensorReadings(value: unknown, key?: string): BlueAirSensorReading[];
export declare function readingsToSensorData(readings: BlueAirSensorReading[]): BlueAirDeviceSensorData;
export declare function readingsToState(readings: BlueAirSensorReading[]): BlueAirDeviceState;
export declare function hasSensorData(sensorData: BlueAirDeviceSensorData): boolean;
//# sourceMappingURL=BlueAirSensorData.d.ts.map