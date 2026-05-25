"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueAirDevice = void 0;
const events_1 = __importDefault(require("events"));
const async_mutex_1 = require("async-mutex");
// https://forum.airnowtech.org/t/the-aqi-equation-2024-valid-beginning-may-6th-2024
const AQI = {
    PM2_5: {
        AQI_LO: [0, 51, 101, 151, 201, 301],
        AQI_HI: [50, 100, 150, 200, 300, 500],
        CONC_LO: [0.0, 9.1, 35.5, 55.5, 125.5, 225.5],
        CONC_HI: [9.0, 35.4, 55.4, 125.4, 225.4, 325.4],
    },
    PM10: {
        AQI_LO: [0, 51, 101, 151, 201, 301],
        AQI_HI: [50, 100, 150, 200, 300, 500],
        CONC_LO: [0, 55, 155, 255, 355, 425],
        CONC_HI: [54, 154, 254, 354, 424, 604],
    },
    VOC: {
        AQI_LO: [0, 51, 101, 151, 201, 301],
        AQI_HI: [50, 100, 150, 200, 300, 500],
        CONC_LO: [0, 221, 661, 1431, 2201, 3301],
        CONC_HI: [220, 660, 1430, 2200, 3300, 5500],
    },
};
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class BlueAirDevice extends events_1.default {
    constructor(device) {
        super();
        this.id = device.id;
        this.name = device.name;
        this.state = device.state;
        this.sensorData = {
            ...device.sensorData,
            aqi: undefined,
        };
        this.sensorData.aqi = this.calculateAqi();
        this.mutex = new async_mutex_1.Mutex();
        this.currentChanges = {
            state: {},
            sensorData: {},
        };
        this.last_brightness = this.state.brightness || 0;
        this.observedFanSpeedMax = 0;
        this.observedBrightnessMax = 0;
        this.updateObservedMaxima(this.state, this.sensorData);
        this.on('update', this.updateState.bind(this));
    }
    hasChanges(changes) {
        return Object.keys(changes.state).length > 0 || Object.keys(changes.sensorData).length > 0;
    }
    async notifyStateUpdate(newState, newSensorData) {
        this.currentChanges = {
            state: {
                ...this.currentChanges.state,
                ...newState,
            },
            sensorData: {
                ...this.currentChanges.sensorData,
                ...newSensorData,
            },
        };
        // always acquire the mutex to ensure all changes are eventually applied
        const release = await this.mutex.acquire();
        const changesToApply = this.currentChanges;
        this.currentChanges = { state: {}, sensorData: {} };
        // if there is a change, emit update event
        if (this.hasChanges(changesToApply)) {
            this.state = { ...this.state, ...changesToApply.state };
            this.sensorData = { ...this.sensorData, ...changesToApply.sensorData };
            this.updateObservedMaxima(changesToApply.state, changesToApply.sensorData);
            this.emit('stateUpdated', { ...changesToApply.state, ...changesToApply.sensorData });
        }
        release();
    }
    async setState(attribute, value) {
        if (attribute in this.state === false) {
            throw new Error(`Invalid state: ${attribute}`);
        }
        if (this.state[attribute] === value) {
            return;
        }
        this.emit('setState', { id: this.id, name: this.name, attribute, value });
        const release = await this.mutex.acquire();
        return new Promise((resolve) => {
            this.once('setStateDone', async (success) => {
                release();
                if (success) {
                    const newState = { [attribute]: value };
                    await this.notifyStateUpdate(newState);
                }
                resolve();
            });
        });
    }
    async setLedOn(value) {
        if (!value) {
            this.last_brightness = this.state.brightness || 0;
        }
        const brightness = value ? this.last_brightness : 0;
        await this.setState('brightness', brightness);
    }
    async updateState(newState) {
        const changedState = {};
        const changedSensorData = {};
        for (const [k, v] of Object.entries(newState.state)) {
            if (this.state[k] !== v) {
                changedState[k] = v;
            }
        }
        for (const [k, v] of Object.entries(newState.sensorData)) {
            if (this.sensorData[k] !== v) {
                changedSensorData[k] = v;
            }
        }
        if ('pm2_5' in changedSensorData || 'pm10' in changedSensorData || 'voc' in changedSensorData) {
            changedSensorData.aqi = this.calculateAqi({ ...this.sensorData, ...changedSensorData });
        }
        await this.notifyStateUpdate(changedState, changedSensorData);
    }
    getObservedFanSpeedMax() {
        return this.observedFanSpeedMax;
    }
    getObservedBrightnessMax() {
        return this.observedBrightnessMax;
    }
    updateObservedMaxima(state, sensorData) {
        const fanSpeed = typeof state.fanspeed === 'number' ? state.fanspeed : sensorData === null || sensorData === void 0 ? void 0 : sensorData.fanspeed;
        if (typeof fanSpeed === 'number' && fanSpeed > this.observedFanSpeedMax) {
            this.observedFanSpeedMax = fanSpeed;
        }
        if (typeof state.brightness === 'number' && state.brightness > this.observedBrightnessMax) {
            this.observedBrightnessMax = state.brightness;
        }
    }
    calculateAqi(sensorData = this.sensorData) {
        if (sensorData.pm2_5 === undefined && sensorData.pm10 === undefined && sensorData.voc === undefined) {
            return undefined;
        }
        const pm2_5 = Math.round((sensorData.pm2_5 || 0) * 10) / 10;
        const pm10 = sensorData.pm10 || 0;
        const voc = sensorData.voc || 0;
        const aqi_pm2_5 = this.calculateAqiForSensor(pm2_5, 'PM2_5');
        const aqi_pm10 = this.calculateAqiForSensor(pm10, 'PM10');
        const aqi_voc = this.calculateAqiForSensor(voc, 'VOC');
        return Math.max(aqi_pm2_5, aqi_pm10, aqi_voc);
    }
    calculateAqiForSensor(value, sensor) {
        const levels = AQI[sensor];
        for (let i = 0; i < levels.AQI_LO.length; i++) {
            if (value >= levels.CONC_LO[i] && value <= levels.CONC_HI[i]) {
                return Math.round(((levels.AQI_HI[i] - levels.AQI_LO[i]) / (levels.CONC_HI[i] - levels.CONC_LO[i])) * (value - levels.CONC_LO[i]) +
                    levels.AQI_LO[i]);
            }
        }
        return 0;
    }
}
exports.BlueAirDevice = BlueAirDevice;
//# sourceMappingURL=BlueAirDevice.js.map