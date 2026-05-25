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
    ignoredFields: ['fsp0'],
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
    displayBrightness: {
        attribute: 'nmbrightness',
        rawMax: 100,
    },
    oscillation: {
        attribute: 'osc',
        stateAttribute: 'oscstate',
        directionAttribute: 'oscdir',
        speedAttribute: 'oscfs',
    },
    sleepTimer: {
        stateAttribute: 'timstate',
        durationAttribute: 'timdur',
        remainingAttribute: 'timl',
        startedAtAttribute: 'timts',
        presetSeconds: [30 * 60, 60 * 60, 2 * 60 * 60, 4 * 60 * 60],
    },
    climate: {
        modeAttribute: 'mainmode',
        heatSetpointAttribute: 'heattemp',
        heatFanAttribute: 'heatfs',
        coolFanAttribute: 'coolfs',
        fanFanAttribute: 'fsp0',
        heatSubmodeAttribute: 'heatsubmode',
        coolSubmodeAttribute: 'coolsubmode',
        autoPurifySubmodeAttribute: 'apsubmode',
    },
    brightnessMax: 10,
    controlKeys: new Set([
        'apsubmode',
        'brightness',
        'childlock',
        'coolfs',
        'coolsubmode',
        'filterusage',
        'fsp0',
        'heatfs',
        'heatsubmode',
        'heattemp',
        'mainmode',
        'nmbrightness',
        'online',
        'osc',
        'oscdir',
        'oscfs',
        'oscstate',
        'standby',
        'timdur',
        'timl',
        'timstate',
        'timts',
        'tu',
    ]),
    ignoredFields: ['ecoheattemp', 'pm2_5c', 'rssi', 'rt1s', 'rt5m', 'rt5s', 'b5m'],
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
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort();
}
function splitSourceNames(value) {
    return value
        .split(/[,\s]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function extractSourceNames(value) {
    if (!value) {
        return [];
    }
    if (typeof value === 'string') {
        return splitSourceNames(value);
    }
    if (Array.isArray(value)) {
        return uniqueSorted(value.flatMap((entry) => extractSourceNames(entry)));
    }
    if (!isRecord(value)) {
        return [];
    }
    if (typeof value.n === 'string') {
        return [value.n];
    }
    if (value.sn !== undefined) {
        return extractSourceNames(value.sn);
    }
    const sensorLikeKeys = Object.keys(value).filter((key) => BlueAirSensorData_1.BlueAirDeviceSensorDataMap[key] || key === 'rssi');
    return uniqueSorted(sensorLikeKeys);
}
function declaredDataSources(deviceInfo) {
    var _a, _b;
    const ds = (_a = deviceInfo.configuration.ds) !== null && _a !== void 0 ? _a : {};
    const dc = (_b = deviceInfo.configuration.dc) !== null && _b !== void 0 ? _b : {};
    return {
        dc: uniqueSorted(Object.keys(dc)),
        ds: uniqueSorted(Object.keys(ds)),
        rt1s: extractSourceNames(ds.rt1s),
        rt5s: extractSourceNames(ds.rt5s),
        rt5m: extractSourceNames(ds.rt5m),
        b5m: extractSourceNames(ds.b5m),
    };
}
function declaredRealtimeSensors(dataSources) {
    return uniqueSorted([...dataSources.rt1s, ...dataSources.rt5s, ...dataSources.rt5m, ...dataSources.b5m]);
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
    const adapter = selectDeviceAdapter(deviceInfo);
    const fieldSources = {};
    const controlState = normalizeControlState(deviceInfo, adapter, fieldSources);
    const fanSpeed = adapter.fanSpeed && controlState[adapter.fanSpeed.attribute] !== undefined ? adapter.fanSpeed : undefined;
    const displayBrightness = adapter.displayBrightness && controlState[adapter.displayBrightness.attribute] !== undefined ? adapter.displayBrightness : undefined;
    const oscillation = adapter.oscillation && controlState[adapter.oscillation.attribute] !== undefined ? adapter.oscillation : undefined;
    const sleepTimer = adapter.sleepTimer &&
        controlState[adapter.sleepTimer.stateAttribute] !== undefined &&
        controlState[adapter.sleepTimer.durationAttribute] !== undefined
        ? adapter.sleepTimer
        : undefined;
    const climate = adapter.climate && controlState[adapter.climate.modeAttribute] !== undefined ? adapter.climate : undefined;
    const sensorState = normalizeSensorState(deviceInfo, fieldSources);
    const dataSources = declaredDataSources(deviceInfo);
    return {
        id: deviceInfo.id,
        name: deviceInfo.configuration.di.name,
        controlState,
        sensorState,
        deviceMetadata: {
            adapterId: adapter.id,
            adapterName: adapter.name,
            fanSpeed,
            displayBrightness,
            oscillation,
            sleepTimer,
            climate,
            brightnessMax: adapter.brightnessMax,
            fieldSources,
            rawSensorNames: deviceInfo.sensordata.map((sensor) => sensor.n),
            rawStateNames: deviceInfo.states.map((state) => state.n),
            dataSourceNames: dataSources.ds,
            declaredDataSources: dataSources,
            declaredRealtimeSensors: declaredRealtimeSensors(dataSources),
            ignoredFields: adapter.ignoredFields,
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