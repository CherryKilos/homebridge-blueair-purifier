import type { BlueAirDeviceState } from '../api/BlueAirAwsApi';
export declare const COMFORT_PURE_TIMER_PRESETS_SECONDS: number[];
export declare const COMFORT_PURE_MAIN_MODE: {
    readonly FAN_ONLY: 0;
    readonly HEAT: 1;
    readonly COOL: 2;
};
export declare function numericStateValue(state: BlueAirDeviceState, key: string): number | undefined;
export declare function booleanStateValue(state: BlueAirDeviceState, key: string): boolean;
export declare function booleanWriteValue(state: BlueAirDeviceState, key: string, enabled: boolean): boolean | number;
export declare function nearestTimerPresetSeconds(seconds: number): number;
export declare function timerDurationSeconds(state: BlueAirDeviceState): number;
export declare function timerRemainingSeconds(state: BlueAirDeviceState, nowSeconds?: number): number;
export declare function blueairTemperatureToCelsius(value: number | undefined): number | undefined;
export declare function celsiusToBlueairSetpoint(value: number): number;
export declare function clampClimateSetpoint(value: number): number;
//# sourceMappingURL=comfortPureControls.d.ts.map