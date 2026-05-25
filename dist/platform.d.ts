/// <reference types="node" />
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { Config } from './platformUtils';
import { BlueAirDeviceStatus } from './api/BlueAirAwsApi';
import EventEmitter from 'events';
export declare class BlueAirPlatform extends EventEmitter implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    readonly platformConfig: Config;
    private readonly blueAirApi;
    private existingUuids;
    private devices;
    private polling;
    private realtimeApi?;
    constructor(log: Logger, config: PlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    getValidDevicesStatus(): Promise<void>;
    getInitialDeviceStates(): Promise<void>;
    startRealtimeSensors(): Promise<void>;
    private logDeclaredRealtimeSensors;
    private handleRealtimeUpdate;
    addDevice(device: BlueAirDeviceStatus): Promise<void>;
}
//# sourceMappingURL=platform.d.ts.map