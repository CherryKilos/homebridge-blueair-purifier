import { Logger } from 'homebridge';
import { Region } from '../platformUtils';
import { BlueAirDeviceStatusResponse } from './Consts';
import type { BlueAirMqttAuth } from './BlueAirMqttTypes';
import { DeviceAdapterMetadata } from '../device/adapters';
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
    fsp0?: number;
    childlock?: boolean;
    nightmode?: boolean;
    mfv?: string;
    automode?: boolean;
    ofv?: string;
    brightness?: number;
    nmbrightness?: number;
    osc?: boolean | number;
    oscstate?: boolean | number;
    oscdir?: number;
    oscfs?: number;
    timstate?: boolean | number;
    timdur?: number;
    timl?: number;
    timts?: number;
    mainmode?: number;
    heattemp?: number;
    heatfs?: number;
    coolfs?: number;
    heatsubmode?: number;
    coolsubmode?: number;
    apsubmode?: number;
    tu?: number;
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
    rssi?: number;
    temperature?: number;
    voc?: number;
    [key: string]: string | number | boolean | undefined;
};
export type BlueAirDeviceStatus = {
    id: string;
    name: string;
    controlState: BlueAirDeviceState;
    sensorState: BlueAirDeviceSensorData;
    deviceMetadata: DeviceAdapterMetadata;
    source?: 'rest' | 'realtime';
    /**
     * Legacy aliases kept for the existing accessory/device code while the plugin
     * transitions to explicit control/sensor state.
     */
    state: BlueAirDeviceState;
    sensorData: BlueAirDeviceSensorData;
};
export type BlueAirHistoricalTelemetry = {
    raw: unknown;
    sensorData: BlueAirDeviceSensorData;
    state: BlueAirDeviceState;
};
export type BlueAirSensorProbeResult = {
    deviceId: string;
    variant: string;
    ok: boolean;
    sensorData?: BlueAirDeviceSensorData;
    state?: BlueAirDeviceState;
    fieldSources?: Record<string, string>;
    response?: unknown;
    error?: string;
};
export default class BlueAirAwsApi {
    private readonly logger;
    private readonly gigyaApi;
    private last_login;
    private mutex;
    private accessToken;
    private blueAirApiUrl;
    private mqttAuthName?;
    private mqttAuthSignature?;
    private mqttAuthToken?;
    private userId?;
    private historicalTelemetryCache;
    private readonly awsConfig;
    constructor(username: string, password: string, region: Region, logger: Logger);
    login(): Promise<void>;
    checkTokenExpiration(): Promise<void>;
    getDevices(): Promise<BlueAirDeviceDiscovery[]>;
    getDeviceStatus(accountUuid: string, uuids: string[]): Promise<BlueAirDeviceStatus[]>;
    getRawDeviceStatus(accountUuid: string, uuids: string[]): Promise<BlueAirDeviceStatusResponse>;
    setDeviceStatus(uuid: string, state: string, value: number | boolean): Promise<void>;
    getMqttAuth(): Promise<BlueAirMqttAuth | undefined>;
    getHistoricalTelemetry(deviceId: string, durationMs?: number): Promise<BlueAirHistoricalTelemetry | undefined>;
    probeInitialSensorVariants(accountUuid: string, deviceId: string): Promise<BlueAirSensorProbeResult[]>;
    private shouldFetchHistoricalTelemetry;
    private withLegacyAliases;
    private sensorStateOnly;
    private extractDeviceInfo;
    private getAwsAccessToken;
    private extractUserId;
    private apiCall;
}
//# sourceMappingURL=BlueAirAwsApi.d.ts.map