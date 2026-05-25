"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeSubscriptionTopics = exports.parseRealtimeMessage = void 0;
const mqtt_1 = require("mqtt");
const BlueAirSensorData_1 = require("./BlueAirSensorData");
const MAX_EMPTY_CLOSES = 4;
const CLOSE_WINDOW_MS = 60 * 1000;
function parseJsonPayload(payload) {
    try {
        return JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : payload);
    }
    catch (_a) {
        return undefined;
    }
}
function parseRealtimeMessage(topic, payload) {
    const raw = parseJsonPayload(payload);
    if (raw === undefined) {
        return undefined;
    }
    const sensorTopicMatch = topic.match(/(?:^|\/)d\/([^/]+)\/s\/(?:1s|5s|5m|batch\/b5m)$/);
    if (sensorTopicMatch) {
        const readings = (0, BlueAirSensorData_1.collectSensorReadings)(raw);
        const sensorData = readOnlyRealtimeSensorData((0, BlueAirSensorData_1.readingsToSensorData)(readings));
        if (!(0, BlueAirSensorData_1.hasSensorData)(sensorData)) {
            return undefined;
        }
        return {
            deviceId: sensorTopicMatch[1],
            sensorData,
            state: {},
            raw,
        };
    }
    const shadowTopicMatch = topic.match(/^\$aws\/things\/([^/]+)\/shadow\/update\/documents$/);
    if (shadowTopicMatch) {
        const readings = (0, BlueAirSensorData_1.collectSensorReadings)(raw);
        const sensorData = readOnlyRealtimeSensorData((0, BlueAirSensorData_1.readingsToSensorData)(readings));
        if (!(0, BlueAirSensorData_1.hasSensorData)(sensorData)) {
            return undefined;
        }
        return {
            deviceId: shadowTopicMatch[1],
            sensorData,
            state: {},
            raw,
        };
    }
    return undefined;
}
exports.parseRealtimeMessage = parseRealtimeMessage;
function readOnlyRealtimeSensorData(sensorData) {
    const readOnlySensorData = { ...sensorData };
    delete readOnlySensorData.fanspeed;
    return readOnlySensorData;
}
function realtimeSubscriptionTopics(deviceIds) {
    return deviceIds.flatMap((deviceId) => [`d/${deviceId}/s/5s`, `$aws/things/${deviceId}/shadow/update/documents`]);
}
exports.realtimeSubscriptionTopics = realtimeSubscriptionTopics;
class BlueAirRealtimeApi {
    constructor(auth, deviceIds, logger, onUpdate) {
        this.auth = auth;
        this.deviceIds = deviceIds;
        this.logger = logger;
        this.onUpdate = onUpdate;
        this.closeTimes = [];
        this.messagesReceived = 0;
        this.stopping = false;
    }
    start() {
        if (this.client) {
            return;
        }
        const options = {
            clientId: `homebridge-blueair-${Date.now()}`,
            clean: true,
            connectTimeout: 30 * 1000,
            keepalive: 60,
            path: '/mqtt',
            protocol: 'wss',
            reconnectPeriod: 5000,
            transformWsUrl: (url, opts) => {
                var _a, _b;
                const wsOptions = ((_a = opts.wsOptions) !== null && _a !== void 0 ? _a : {});
                opts.wsOptions = {
                    ...wsOptions,
                    headers: {
                        ...((_b = wsOptions.headers) !== null && _b !== void 0 ? _b : {}),
                        'X-Amz-CustomAuthorizer-Name': this.auth.customAuthorizerName,
                        'X-Amz-CustomAuthorizer-Signature': this.auth.customAuthorizerSignature,
                        'X-Amz-CustomAuthorizer-Token': this.auth.customAuthorizerToken,
                    },
                };
                return url;
            },
        };
        this.client = (0, mqtt_1.connect)(`wss://${this.auth.broker}:443/mqtt`, options);
        this.client.on('connect', () => {
            this.logger.debug('Blueair realtime sensor stream connected');
            this.subscribe();
            this.startResubscribeTimer();
        });
        this.client.on('reconnect', () => this.logger.debug('Blueair realtime sensor stream reconnecting'));
        this.client.on('error', (error) => this.logger.warn(`Blueair realtime sensor stream error: ${error.message}`));
        this.client.on('close', () => this.handleClose());
        this.client.on('message', (topic, payload) => {
            const update = parseRealtimeMessage(topic, payload);
            if (update) {
                this.messagesReceived++;
                this.onUpdate(update);
            }
        });
    }
    stop() {
        this.stopping = true;
        if (this.resubscribeTimer) {
            clearInterval(this.resubscribeTimer);
            this.resubscribeTimer = undefined;
        }
        if (this.client) {
            this.client.end(true);
            this.client = undefined;
        }
    }
    subscribe() {
        var _a;
        if (!((_a = this.client) === null || _a === void 0 ? void 0 : _a.connected)) {
            return;
        }
        const topics = realtimeSubscriptionTopics(this.deviceIds);
        this.client.subscribe(topics, { qos: 0 }, (error) => {
            if (error) {
                this.logger.warn(`Blueair realtime sensor subscription failed: ${error.message}`);
            }
            else {
                this.logger.debug(`Blueair realtime sensor subscription active for ${this.deviceIds.length} device(s)`);
            }
        });
    }
    startResubscribeTimer() {
        if (this.resubscribeTimer) {
            return;
        }
        this.resubscribeTimer = setInterval(() => this.subscribe(), 15 * 60 * 1000);
    }
    handleClose() {
        if (this.stopping) {
            return;
        }
        this.logger.debug('Blueair realtime sensor stream closed');
        if (this.messagesReceived > 0) {
            this.closeTimes = [];
            return;
        }
        const now = Date.now();
        this.closeTimes = [...this.closeTimes, now].filter((closeTime) => now - closeTime <= CLOSE_WINDOW_MS);
        if (this.closeTimes.length >= MAX_EMPTY_CLOSES) {
            this.logger.warn('Blueair realtime sensor stream closed repeatedly before delivering sensor data. ' +
                'Disabling realtime sensors; REST polling will continue.');
            this.stop();
        }
    }
}
exports.default = BlueAirRealtimeApi;
//# sourceMappingURL=BlueAirRealtimeApi.js.map