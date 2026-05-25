import { Logger } from 'homebridge';
import { Region } from '../platformUtils';
import { BlueAirDeviceStatusResponse } from './Consts';
export type BlueAirDeviceDiscovery = {
    mac: string;
    'mcu-firmware': string;
    name: string;
    type: string;
    'user-type': string;
    uuid: string;
    'wifi-firmware': string;
};
export type FullBlueAirDeviceState = BlueAirDeviceState & BlueAirDeviceSensorData;
export type BlueAirDeviceState = {
    cfv?: string;
    germshield?: boolean;
    gsnm?: boolean;
    standby?: boolean;
    fanspeed?: number;
    childlock?: boolean;
    nightmode?: boolean;
    mfv?: string;
    automode?: boolean;
    ofv?: string;
    brightness?: number;
    safetyswitch?: boolean;
    filterusage?: number;
    disinfection?: boolean;
    disinftime?: number;
    [key: string]: string | number | boolean | undefined;
};
export type BlueAirDeviceSensorData = {
    fanspeed?: number;
    hcho?: number;
    humidity?: number;
    pm1?: number;
    pm10?: number;
    pm2_5?: number;
    temperature?: number;
    voc?: number;
    [key: string]: string | number | boolean | undefined;
};
export type BlueAirDeviceStatus = {
    id: string;
    name: string;
    state: BlueAirDeviceState;
    sensorData: BlueAirDeviceSensorData;
};
export declare const BlueAirDeviceSensorDataMap: Record<string, keyof BlueAirDeviceSensorData>;
export default class BlueAirAwsApi {
    private readonly logger;
    private readonly gigyaApi;
    private last_login;
    private mutex;
    private accessToken;
    private blueAirApiUrl;
    constructor(username: string, password: string, region: Region, logger: Logger);
    login(): Promise<void>;
    checkTokenExpiration(): Promise<void>;
    getDevices(): Promise<BlueAirDeviceDiscovery[]>;
    getDeviceStatus(accountUuid: string, uuids: string[]): Promise<BlueAirDeviceStatus[]>;
    getRawDeviceStatus(accountUuid: string, uuids: string[]): Promise<BlueAirDeviceStatusResponse>;
    setDeviceStatus(uuid: string, state: string, value: number | boolean): Promise<void>;
    private getAwsAccessToken;
    private apiCall;
}
//# sourceMappingURL=BlueAirAwsApi.d.ts.map