/// <reference types="node" />
import type { Logger } from 'homebridge';
import type { BlueAirDeviceSensorData, BlueAirDeviceState } from './BlueAirAwsApi';
import type { BlueAirMqttAuth } from './BlueAirMqttTypes';
export type BlueAirRealtimeUpdate = {
    deviceId: string;
    sensorData: BlueAirDeviceSensorData;
    state: BlueAirDeviceState;
    raw: unknown;
};
export declare function parseRealtimeMessage(topic: string, payload: Buffer | string): BlueAirRealtimeUpdate | undefined;
export declare function realtimeSubscriptionTopics(deviceIds: string[]): string[];
export default class BlueAirRealtimeApi {
    private readonly auth;
    private readonly deviceIds;
    private readonly logger;
    private readonly onUpdate;
    private client?;
    private resubscribeTimer?;
    private closeTimes;
    private messagesReceived;
    private stopping;
    constructor(auth: BlueAirMqttAuth, deviceIds: string[], logger: Logger, onUpdate: (update: BlueAirRealtimeUpdate) => void);
    start(): void;
    stop(): void;
    private subscribe;
    private startResubscribeTimer;
    private handleClose;
}
//# sourceMappingURL=BlueAirRealtimeApi.d.ts.map