/// <reference types="node" />
import EventEmitter from 'events';
import { BlueAirDeviceSensorData, BlueAirDeviceState, BlueAirDeviceStatus, FullBlueAirDeviceState } from '../api/BlueAirAwsApi';
type BlueAirSensorDataWithAqi = BlueAirDeviceSensorData & {
    aqi?: number;
};
interface BlueAirDeviceEvents {
    stateUpdated: (changedStates: Partial<FullBlueAirDeviceState>) => void;
    update: (newState: BlueAirDeviceStatus) => void;
    setState: (data: {
        id: string;
        name: string;
        attribute: string;
        value: number | boolean;
    }) => void;
    setStateDone: (success: boolean) => void;
}
export interface BlueAirDevice {
    on<K extends keyof BlueAirDeviceEvents>(event: K, listener: BlueAirDeviceEvents[K]): this;
    emit<K extends keyof BlueAirDeviceEvents>(event: K, ...args: Parameters<BlueAirDeviceEvents[K]>): boolean;
    once<K extends keyof BlueAirDeviceEvents>(event: K, listener: BlueAirDeviceEvents[K]): this;
}
export declare class BlueAirDevice extends EventEmitter {
    controlState: BlueAirDeviceState;
    sensorState: BlueAirSensorDataWithAqi;
    deviceMetadata: BlueAirDeviceStatus['deviceMetadata'];
    /**
     * Legacy aliases for accessory code that still reads state/sensorData.
     */
    state: BlueAirDeviceState;
    sensorData: BlueAirSensorDataWithAqi;
    readonly id: string;
    readonly name: string;
    private mutex;
    private currentChanges;
    private last_brightness;
    private observedFanSpeedMax;
    private observedBrightnessMax;
    constructor(device: BlueAirDeviceStatus);
    private hasChanges;
    private notifyStateUpdate;
    setState(attribute: string, value: number | boolean): Promise<void>;
    setLedOn(value: boolean): Promise<void>;
    private updateState;
    getObservedFanSpeedMax(): number;
    getObservedBrightnessMax(): number;
    private updateObservedMaxima;
    private calculateAqi;
    private calculateAqiForSensor;
}
export {};
//# sourceMappingURL=BlueAirDevice.d.ts.map