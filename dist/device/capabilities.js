"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brightnessMaxForDevice = exports.fanSpeedMaxForWritableState = exports.fanSpeedMaxForDevice = exports.temperatureToCelsius = exports.percentToRaw = exports.rawToPercent = exports.resolveBrightnessMax = exports.resolveFanSpeedMax = exports.shouldExposeDetectedService = exports.shouldExposeService = exports.inferDeviceCapabilities = void 0;
const DEFAULT_FAN_SPEED_MAX = 3;
const LOW_RANGE_BRIGHTNESS_MAX = 10;
const PERCENT_MAX = 100;
function hasValue(value) {
    return value !== undefined;
}
function inferDeviceCapabilities(state, sensorData) {
    const hasPm2_5 = hasValue(sensorData.pm2_5);
    const hasPm10 = hasValue(sensorData.pm10);
    const hasVoc = hasValue(sensorData.voc);
    return {
        sensors: {
            airQuality: hasPm2_5 || hasPm10 || hasVoc,
            hcho: hasValue(sensorData.hcho),
            humidity: hasValue(sensorData.humidity),
            pm1: hasValue(sensorData.pm1),
            pm10: hasPm10,
            pm2_5: hasPm2_5,
            temperature: hasValue(sensorData.temperature),
            voc: hasVoc,
        },
        controls: {
            autoMode: hasValue(state.automode),
            brightness: hasValue(state.brightness),
            childLock: hasValue(state.childlock),
            displayBrightness: hasValue(state.nmbrightness),
            filterUsage: hasValue(state.filterusage),
            fanSpeed: hasValue(state.fanspeed) || hasValue(state.fsp0),
            germShield: hasValue(state.germshield),
            nightMode: hasValue(state.nightmode),
            oscillation: hasValue(state.osc),
            sleepTimer: hasValue(state.timstate) && hasValue(state.timdur),
            comfortPureClimate: hasValue(state.mainmode),
        },
    };
}
exports.inferDeviceCapabilities = inferDeviceCapabilities;
function shouldExposeService(service, legacyConfigEnabled, capabilityDetected, autoExposeAvailableServices, disabledServices = []) {
    if (disabledServices.includes(service)) {
        return false;
    }
    return legacyConfigEnabled || (autoExposeAvailableServices && capabilityDetected);
}
exports.shouldExposeService = shouldExposeService;
function shouldExposeDetectedService(service, legacyConfigEnabled, capabilityDetected, autoExposeAvailableServices, disabledServices = []) {
    return (capabilityDetected &&
        shouldExposeService(service, legacyConfigEnabled, capabilityDetected, autoExposeAvailableServices, disabledServices));
}
exports.shouldExposeDetectedService = shouldExposeDetectedService;
function resolveFanSpeedMax(configuredMax, observedMax) {
    if (configuredMax && configuredMax > 0) {
        return configuredMax;
    }
    if (observedMax && observedMax > 0 && observedMax <= LOW_RANGE_BRIGHTNESS_MAX) {
        return Math.max(observedMax, DEFAULT_FAN_SPEED_MAX);
    }
    if (observedMax && observedMax > LOW_RANGE_BRIGHTNESS_MAX) {
        return PERCENT_MAX;
    }
    return DEFAULT_FAN_SPEED_MAX;
}
exports.resolveFanSpeedMax = resolveFanSpeedMax;
function resolveBrightnessMax(configuredMax, observedMax) {
    if (configuredMax && configuredMax > 0) {
        return configuredMax;
    }
    if (observedMax && observedMax > 0 && observedMax <= LOW_RANGE_BRIGHTNESS_MAX) {
        return LOW_RANGE_BRIGHTNESS_MAX;
    }
    return PERCENT_MAX;
}
exports.resolveBrightnessMax = resolveBrightnessMax;
function rawToPercent(rawValue, rawMax) {
    if (!rawValue || rawValue <= 0 || rawMax <= 0) {
        return 0;
    }
    return Math.min(PERCENT_MAX, Math.round((rawValue / rawMax) * PERCENT_MAX));
}
exports.rawToPercent = rawToPercent;
function percentToRaw(percentValue, rawMax) {
    if (percentValue <= 0 || rawMax <= 0) {
        return 0;
    }
    return Math.max(1, Math.round((Math.min(PERCENT_MAX, percentValue) / PERCENT_MAX) * rawMax));
}
exports.percentToRaw = percentToRaw;
function temperatureToCelsius(value, inputUnit = 'auto') {
    if (value === undefined) {
        return 0;
    }
    const normalizedValue = Math.abs(value) > 125 && Math.abs(value) <= 1250 ? value / 10 : value;
    if (inputUnit === 'celsius') {
        return normalizedValue;
    }
    if (inputUnit === 'fahrenheit' || normalizedValue > 45) {
        return Math.round((((normalizedValue - 32) * 5) / 9) * 10) / 10;
    }
    return normalizedValue;
}
exports.temperatureToCelsius = temperatureToCelsius;
function fanSpeedMaxForDevice(config, observedMax) {
    return resolveFanSpeedMax(config.fanSpeedMax, observedMax);
}
exports.fanSpeedMaxForDevice = fanSpeedMaxForDevice;
function fanSpeedMaxForWritableState(config, state, writableAttribute, observedMax) {
    if (config.fanSpeedMax && config.fanSpeedMax > 0) {
        return config.fanSpeedMax;
    }
    const writableValue = state[writableAttribute];
    const writableObservedMax = typeof writableValue === 'number' ? writableValue : undefined;
    if (writableAttribute === 'fanspeed') {
        return resolveFanSpeedMax(undefined, writableObservedMax);
    }
    return resolveFanSpeedMax(undefined, writableObservedMax !== null && writableObservedMax !== void 0 ? writableObservedMax : observedMax);
}
exports.fanSpeedMaxForWritableState = fanSpeedMaxForWritableState;
function brightnessMaxForDevice(config, observedMax) {
    return resolveBrightnessMax(config.brightnessMax, observedMax);
}
exports.brightnessMaxForDevice = brightnessMaxForDevice;
//# sourceMappingURL=capabilities.js.map