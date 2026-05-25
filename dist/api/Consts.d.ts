import { Region } from '../platformUtils';
type AWSConfigValue = {
    restApiId: string;
    awsRegion: string;
    mqttBroker: string;
};
type GigyaConfigValue = {
    gigyaRegion: string;
    apiKey: string;
};
export declare function getAwsConfig(region: Region): AWSConfigValue;
export declare function getGigyaConfig(region: Region): GigyaConfigValue;
export declare const LOGIN_EXPIRATION: number;
export declare const BLUEAIR_API_TIMEOUT: number;
export type BlueAirDeviceStatusResponse = {
    deviceInfo: {
        id: string;
        configuration: {
            di: {
                name: string;
                hw?: string;
                sku?: string;
                [key: string]: unknown;
            };
            dc?: Record<string, unknown>;
            ds?: Record<string, unknown>;
        };
        sensordata: {
            n: string;
            t: number;
            v: number;
        }[];
        states: {
            n: string;
            t: number;
            v?: number;
            vb?: boolean;
        }[];
    }[];
};
export {};
//# sourceMappingURL=Consts.d.ts.map