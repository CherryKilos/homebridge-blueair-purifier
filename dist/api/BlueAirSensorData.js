"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSensorData = exports.readingsToState = exports.readingsToSensorData = exports.collectSensorReadings = exports.BlueAirDeviceSensorDataMap = void 0;
exports.BlueAirDeviceSensorDataMap = {
    fsp0: 'fanspeed',
    hcho: 'hcho',
    h: 'humidity',
    pm1: 'pm1',
    pm10: 'pm10',
    pm2_: 'pm2_5',
    pm2_5: 'pm2_5',
    t: 'temperature',
    tVOC: 'voc',
    voc: 'voc',
};
const STATE_SENSOR_NAMES = new Set(['fsp0', 'fanspeed']);
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isSensorReading(value) {
    return isObject(value) && typeof value.n === 'string' && ('v' in value || 'vb' in value);
}
function collectSensorReadings(value, key = '') {
    if (typeof value === 'number' && exports.BlueAirDeviceSensorDataMap[key]) {
        return [{ n: key, v: value }];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => {
            if (typeof entry === 'number' && exports.BlueAirDeviceSensorDataMap[key]) {
                return [{ n: key, v: entry }];
            }
            if (isObject(entry) && exports.BlueAirDeviceSensorDataMap[key] && typeof entry.v === 'number') {
                return [
                    {
                        n: key,
                        t: typeof entry.t === 'number' ? entry.t : undefined,
                        v: entry.v,
                    },
                ];
            }
            return collectSensorReadings(entry, key);
        });
    }
    if (!isObject(value)) {
        return [];
    }
    if (exports.BlueAirDeviceSensorDataMap[key] && typeof value.v === 'number') {
        return [
            {
                n: key,
                t: typeof value.t === 'number' ? value.t : undefined,
                v: value.v,
            },
        ];
    }
    if (isSensorReading(value)) {
        return [value];
    }
    const readings = [];
    for (const [entryKey, entry] of Object.entries(value)) {
        if (entry && typeof entry === 'object') {
            readings.push(...collectSensorReadings(entry, entryKey));
        }
        else {
            readings.push(...collectSensorReadings(entry, entryKey));
        }
    }
    return readings;
}
exports.collectSensorReadings = collectSensorReadings;
function readingsToSensorData(readings) {
    const sensorData = {};
    const latestScores = new Map();
    readings.forEach((reading, index) => {
        if (!reading.n || typeof reading.v !== 'number') {
            return;
        }
        const key = exports.BlueAirDeviceSensorDataMap[reading.n];
        if (!key) {
            return;
        }
        const score = typeof reading.t === 'number' ? reading.t : index;
        const currentScore = latestScores.get(key);
        if (currentScore === undefined || score >= currentScore) {
            sensorData[key] = reading.v;
            latestScores.set(key, score);
        }
    });
    return sensorData;
}
exports.readingsToSensorData = readingsToSensorData;
function readingsToState(readings) {
    return readings.reduce((state, reading) => {
        if (!reading.n || !STATE_SENSOR_NAMES.has(reading.n)) {
            return state;
        }
        if (typeof reading.v === 'number') {
            state[reading.n] = reading.v;
        }
        else if (typeof reading.vb === 'boolean') {
            state[reading.n] = reading.vb;
        }
        return state;
    }, {});
}
exports.readingsToState = readingsToState;
function hasSensorData(sensorData) {
    return Object.keys(sensorData).length > 0;
}
exports.hasSensorData = hasSensorData;
//# sourceMappingURL=BlueAirSensorData.js.map