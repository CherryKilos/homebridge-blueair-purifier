"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanPercentToRaw = exports.fanRawToPercent = exports.normalizeRawDeviceInfo = void 0;
const BlueAirSensorData_1 = require("../api/BlueAirSensorData");
const BLUE_PURE_MAX_ADAPTER = {
    id: 'blue-pure-max',
    name: 'Blue Pure Max',
    fanSpeed: {
        attribute: 'fanspeed',
        rawMax: 91,
    },
    brightnessMax: 100,
    controlKeys: new Set(['automode', 'brightness', 'childlock', 'fanspeed', 'filterusage', 'germshield', 'nightmode', 'online', 'standby']),
    matches: (deviceInfo) => {
        const hardware = hardwareName(deviceInfo);
        return (hardware.startsWith('nb_') ||
            hardware.startsWith('high') ||
            hasState(deviceInfo, 'fanspeed') ||
            deviceInfo.configuration.di.name.toLowerCase().includes('blue pure'));
    },
};
const COMFORT_PURE_T10I_ADAPTER = {
    id: 'comfort-pure-t10i',
    name: 'ComfortPure 3-in-1 T10i',
    fanSpeed: {
        attribute: 'fsp0',
        rawMax: 91,
        rawValues: [11, 37, 64, 91],
    },
    brightnessMax: 10,
    controlKeys: new Set(['brightness', 'childlock', 'filterusage', 'fsp0', 'online', 'standby']),
    matches: (deviceInfo) => hardwareName(deviceInfo).startsWith('cmb3in1') ||
        deviceInfo.configuration.di.name.toLowerCase().includes('comfort') ||
        (hasState(deviceInfo, 'fsp0') &&
            (hasState(deviceInfo, 'heattemp') || hasState(deviceInfo, 'coolfs') || hasState(deviceInfo, 'heatfs'))),
};
const ADAPTERS = [COMFORT_PURE_T10I_ADAPTER, BLUE_PURE_MAX_ADAPTER];
function hasState(deviceInfo, name) {
    return deviceInfo.states.some((state) => state.n === name);
}
function hardwareName(deviceInfo) {
    return typeof deviceInfo.configuration.di.hw === 'string' ? deviceInfo.configuration.di.hw : '';
}
function sku(deviceInfo) {
    return typeof deviceInfo.configuration.di.sku === 'string' ? deviceInfo.configuration.di.sku : undefined;
}
function stateValue(state) {
    if (state.v !== undefined) {
        return state.v;
    }
    if (state.vb !== undefined) {
        return state.vb;
    }
    return undefined;
}
function normalizeControlState(deviceInfo, adapter, fieldSources) {
    return deviceInfo.states.reduce((controlState, state) => {
        if (!adapter.controlKeys.has(state.n)) {
            return controlState;
        }
        const value = stateValue(state);
        if (value !== undefined) {
            controlState[state.n] = value;
            fieldSources[`controlState.${state.n}`] = `states[n=${state.n}].${state.v !== undefined ? 'v' : 'vb'}`;
        }
        return controlState;
    }, {});
}
function normalizeSensorState(deviceInfo, fieldSources) {
    return deviceInfo.sensordata.reduce((sensorState, sensor) => {
        const key = BlueAirSensorData_1.BlueAirDeviceSensorDataMap[sensor.n];
        if (!key || key === 'fanspeed') {
            return sensorState;
        }
        sensorState[key] = sensor.v;
        fieldSources[`sensorState.${key}`] = `sensordata[n=${sensor.n}].v`;
        return sensorState;
    }, {});
}
function selectDeviceAdapter(deviceInfo) {
    var _a;
    return (_a = ADAPTERS.find((adapter) => adapter.matches(deviceInfo))) !== null && _a !== void 0 ? _a : BLUE_PURE_MAX_ADAPTER;
}
function normalizeRawDeviceInfo(deviceInfo) {
    var _a;
    const adapter = selectDeviceAdapter(deviceInfo);
    const fieldSources = {};
    const controlState = normalizeControlState(deviceInfo, adapter, fieldSources);
    const fanSpeed = adapter.fanSpeed && controlState[adapter.fanSpeed.attribute] !== undefined ? adapter.fanSpeed : undefined;
    const sensorState = normalizeSensorState(deviceInfo, fieldSources);
    return {
        id: deviceInfo.id,
        name: deviceInfo.configuration.di.name,
        controlState,
        sensorState,
        deviceMetadata: {
            adapterId: adapter.id,
            adapterName: adapter.name,
            fanSpeed,
            brightnessMax: adapter.brightnessMax,
            fieldSources,
            rawSensorNames: deviceInfo.sensordata.map((sensor) => sensor.n),
            rawStateNames: deviceInfo.states.map((state) => state.n),
            dataSourceNames: Object.keys((_a = deviceInfo.configuration.ds) !== null && _a !== void 0 ? _a : {}),
            hardware: hardwareName(deviceInfo) || undefined,
            sku: sku(deviceInfo),
        },
    };
}
exports.normalizeRawDeviceInfo = normalizeRawDeviceInfo;
function fanRawToPercent(rawValue, spec) {
    var _a;
    if (!rawValue || rawValue <= 0 || spec.rawMax <= 0) {
        return 0;
    }
    if ((_a = spec.rawValues) === null || _a === void 0 ? void 0 : _a.length) {
        const closestIndex = spec.rawValues.reduce((bestIndex, candidate, index) => {
            return Math.abs(candidate - rawValue) < Math.abs(spec.rawValues[bestIndex] - rawValue) ? index : bestIndex;
        }, 0);
        return Math.round(((closestIndex + 1) / spec.rawValues.length) * 100);
    }
    return Math.min(100, Math.round((rawValue / spec.rawMax) * 100));
}
exports.fanRawToPercent = fanRawToPercent;
function fanPercentToRaw(percentValue, spec) {
    var _a;
    if (percentValue <= 0 || spec.rawMax <= 0) {
        return 0;
    }
    const clampedPercent = Math.min(100, percentValue);
    if ((_a = spec.rawValues) === null || _a === void 0 ? void 0 : _a.length) {
        const bucketSize = 100 / spec.rawValues.length;
        const index = Math.min(spec.rawValues.length - 1, Math.max(0, Math.ceil(clampedPercent / bucketSize) - 1));
        return spec.rawValues[index];
    }
    return Math.max(1, Math.round((clampedPercent / 100) * spec.rawMax));
}
exports.fanPercentToRaw = fanPercentToRaw;
//# sourceMappingURL=adapters.js.map