"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampClimateSetpoint = exports.celsiusToBlueairSetpoint = exports.blueairTemperatureToCelsius = exports.displayBrightnessToPercent = exports.displayBrightnessIsOn = exports.timerRemainingSeconds = exports.timerDurationSeconds = exports.nearestTimerPresetSeconds = exports.booleanWriteValue = exports.booleanStateValue = exports.numericStateValue = exports.COMFORT_PURE_MAIN_MODE = exports.COMFORT_PURE_DISPLAY_OFF_FLOOR = exports.COMFORT_PURE_TIMER_PRESETS_SECONDS = void 0;
exports.COMFORT_PURE_TIMER_PRESETS_SECONDS = [30 * 60, 60 * 60, 2 * 60 * 60, 4 * 60 * 60];
exports.COMFORT_PURE_DISPLAY_OFF_FLOOR = 7;
exports.COMFORT_PURE_MAIN_MODE = {
    FAN_ONLY: 0,
    HEAT: 1,
    COOL: 2,
};
function numericStateValue(state, key) {
    const value = state[key];
    return typeof value === 'number' ? value : undefined;
}
exports.numericStateValue = numericStateValue;
function booleanStateValue(state, key) {
    const value = state[key];
    return value === true || value === 1;
}
exports.booleanStateValue = booleanStateValue;
function booleanWriteValue(state, key, enabled) {
    return typeof state[key] === 'number' ? (enabled ? 1 : 0) : enabled;
}
exports.booleanWriteValue = booleanWriteValue;
function nearestTimerPresetSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return exports.COMFORT_PURE_TIMER_PRESETS_SECONDS[1];
    }
    return exports.COMFORT_PURE_TIMER_PRESETS_SECONDS.reduce((closest, preset) => Math.abs(preset - seconds) < Math.abs(closest - seconds) ? preset : closest);
}
exports.nearestTimerPresetSeconds = nearestTimerPresetSeconds;
function timerDurationSeconds(state) {
    var _a;
    return nearestTimerPresetSeconds((_a = numericStateValue(state, 'timdur')) !== null && _a !== void 0 ? _a : exports.COMFORT_PURE_TIMER_PRESETS_SECONDS[1]);
}
exports.timerDurationSeconds = timerDurationSeconds;
function timerRemainingSeconds(state, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!booleanStateValue(state, 'timstate')) {
        return 0;
    }
    const explicitRemaining = numericStateValue(state, 'timl');
    if (explicitRemaining !== undefined) {
        return Math.max(0, Math.round(explicitRemaining));
    }
    const duration = timerDurationSeconds(state);
    const startedAt = numericStateValue(state, 'timts');
    if (startedAt === undefined || startedAt <= 0) {
        return duration;
    }
    return Math.max(0, Math.round(duration - (nowSeconds - startedAt)));
}
exports.timerRemainingSeconds = timerRemainingSeconds;
function displayBrightnessIsOn(value, offFloor = 0) {
    return value !== undefined && value > offFloor;
}
exports.displayBrightnessIsOn = displayBrightnessIsOn;
function displayBrightnessToPercent(value, rawMax, offFloor = 0) {
    if (value === undefined || !displayBrightnessIsOn(value, offFloor) || rawMax <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((value / rawMax) * 100));
}
exports.displayBrightnessToPercent = displayBrightnessToPercent;
function blueairTemperatureToCelsius(value) {
    if (value === undefined) {
        return undefined;
    }
    return Math.abs(value) > 125 && Math.abs(value) <= 1250 ? value / 10 : value;
}
exports.blueairTemperatureToCelsius = blueairTemperatureToCelsius;
function celsiusToBlueairSetpoint(value) {
    return Math.round(value * 10);
}
exports.celsiusToBlueairSetpoint = celsiusToBlueairSetpoint;
function clampClimateSetpoint(value) {
    return Math.min(35, Math.max(10, value));
}
exports.clampClimateSetpoint = clampClimateSetpoint;
//# sourceMappingURL=comfortPureControls.js.map