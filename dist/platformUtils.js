"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultDeviceConfig = exports.defaultConfig = exports.Region = void 0;
var Region;
(function (Region) {
    Region["EU"] = "Default (all other regions)";
    Region["AU"] = "Australia";
    Region["CN"] = "China";
    Region["RU"] = "Russia";
    Region["US"] = "USA";
})(Region || (exports.Region = Region = {}));
exports.defaultConfig = {
    name: 'BlueAir Platform',
    uiDebug: false,
    verboseLogging: false,
    username: '',
    password: '',
    accountUuid: '',
    region: Region.EU,
    autoExposeAvailableServices: true,
    realtimeSensors: 'off',
    sensorProbeEnabled: false,
    pollingInterval: 15000,
    devices: [],
};
exports.defaultDeviceConfig = {
    id: '',
    name: '',
    model: '',
    serialNumber: '',
    filterChangeLevel: 90,
    temperatureInputUnit: 'auto',
    fanSpeedMax: 0,
    brightnessMax: 0,
    disabledServices: [],
    led: false,
    airQualitySensor: false,
    co2Sensor: false,
    temperatureSensor: false,
    humiditySensor: false,
    germShield: false,
    nightMode: false,
};
//# sourceMappingURL=platformUtils.js.map