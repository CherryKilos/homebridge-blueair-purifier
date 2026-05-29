import { BlueAirDeviceSensorData, BlueAirDeviceState } from '../api/BlueAirAwsApi';
import { DeviceConfig, DisabledService, TemperatureInputUnit } from '../platformUtils';
export type DeviceCapabilities = {
    sensors: {
        airQuality: boolean;
        hcho: boolean;
        humidity: boolean;
        pm1: boolean;
        pm10: boolean;
        pm2_5: boolean;
        temperature: boolean;
        voc: boolean;
    };
    controls: {
        autoMode: boolean;
        brightness: boolean;
        childLock: boolean;
        displayBrightness: boolean;
        filterUsage: boolean;
        fanSpeed: boolean;
        germShield: boolean;
        nightMode: boolean;
        oscillation: boolean;
        sleepTimer: boolean;
        comfortPureClimate: boolean;
    };
};
export declare function clampPercent(value: number): number;
export declare function inferDeviceCapabilities(state: BlueAirDeviceState, sensorData: BlueAirDeviceSensorData): DeviceCapabilities;
export declare function shouldExposeService(service: DisabledService, legacyConfigEnabled: boolean, capabilityDetected: boolean, autoExposeAvailableServices: boolean, disabledServices?: DisabledService[]): boolean;
export declare function shouldExposeDetectedService(service: DisabledService, legacyConfigEnabled: boolean, capabilityDetected: boolean, autoExposeAvailableServices: boolean, disabledServices?: DisabledService[]): boolean;
export declare function shouldExposeLedService(legacyConfigEnabled: boolean, capabilityDetected: boolean, displayLightDetected: boolean, autoExposeAvailableServices: boolean, disabledServices?: DisabledService[]): boolean;
export declare function resolveFanSpeedMax(configuredMax?: number, observedMax?: number): number;
export declare function resolveBrightnessMax(configuredMax?: number, observedMax?: number): number;
export declare function rawToPercent(rawValue: number | undefined, rawMax: number): number;
export declare function percentToRaw(percentValue: number, rawMax: number): number;
export declare function temperatureToCelsius(value: number | undefined, inputUnit?: TemperatureInputUnit): number;
export declare function fanSpeedMaxForDevice(config: DeviceConfig, observedMax: number): number;
export declare function fanSpeedMaxForWritableState(config: DeviceConfig, state: BlueAirDeviceState, writableAttribute: 'fanspeed' | 'fsp0', observedMax: number): number;
export declare function brightnessMaxForDevice(config: DeviceConfig, observedMax: number): number;
//# sourceMappingURL=capabilities.d.ts.map