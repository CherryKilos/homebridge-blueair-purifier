"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirPurifierAccessory = void 0;
const capabilities_1 = require("../device/capabilities");
const adapters_1 = require("../device/adapters");
class AirPurifierAccessory {
    constructor(platform, accessory, device, configDev) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.platform = platform;
        this.accessory = accessory;
        this.device = device;
        this.configDev = configDev;
        this.supportsAutoMode = false;
        this.supportsChildLock = false;
        this.supportsFanSpeed = false;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'BlueAir')
            .setCharacteristic(this.platform.Characteristic.Model, this.configDev.model || 'BlueAir Purifier')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.configDev.serialNumber || 'BlueAir Device');
        const capabilities = (0, capabilities_1.inferDeviceCapabilities)(this.device.controlState, this.device.sensorState);
        const autoExposeAvailableServices = this.platform.platformConfig.autoExposeAvailableServices;
        const disabledServices = (_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : [];
        this.supportsAutoMode = capabilities.controls.autoMode;
        this.supportsChildLock = capabilities.controls.childLock;
        this.supportsFanSpeed = Boolean(this.device.deviceMetadata.fanSpeed);
        this.service =
            this.accessory.getService(this.platform.Service.AirPurifier) || this.accessory.addService(this.platform.Service.AirPurifier);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.configDev.name);
        this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState).onGet(this.getCurrentAirPurifierState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
            .onGet(this.getTargetAirPurifierState.bind(this))
            .onSet(this.setTargetAirPurifierState.bind(this));
        if (this.supportsChildLock) {
            this.service
                .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
                .onGet(this.getLockPhysicalControls.bind(this))
                .onSet(this.setLockPhysicalControls.bind(this));
        }
        else {
            this.removeCharacteristicIfPresent(this.service, this.platform.Characteristic.LockPhysicalControls);
        }
        if (this.supportsFanSpeed) {
            this.service
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .onGet(this.getRotationSpeed.bind(this))
                .onSet(this.setRotationSpeed.bind(this));
        }
        else {
            this.removeCharacteristicIfPresent(this.service, this.platform.Characteristic.RotationSpeed);
        }
        this.filterMaintenanceService =
            this.accessory.getService(this.platform.Service.FilterMaintenance) ||
                this.accessory.addService(this.platform.Service.FilterMaintenance);
        this.filterMaintenanceService
            .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
            .onGet(this.getFilterChangeIndication.bind(this));
        this.filterMaintenanceService.getCharacteristic(this.platform.Characteristic.FilterLifeLevel).onGet(this.getFilterLifeLevel.bind(this));
        this.ledService = this.accessory.getServiceById(this.platform.Service.Lightbulb, 'Led');
        if ((0, capabilities_1.shouldExposeService)('led', this.configDev.led, capabilities.controls.brightness, autoExposeAvailableServices, disabledServices)) {
            (_b = this.ledService) !== null && _b !== void 0 ? _b : (this.ledService = this.accessory.addService(this.platform.Service.Lightbulb, `${this.device.name} Led`, 'Led'));
            this.ledService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Led`);
            this.ledService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Led`);
            this.ledService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getLedOn.bind(this)).onSet(this.setLedOn.bind(this));
            this.ledService
                .getCharacteristic(this.platform.Characteristic.Brightness)
                .onGet(this.getLedBrightness.bind(this))
                .onSet(this.setLedBrightness.bind(this));
        }
        else if (this.ledService) {
            this.accessory.removeService(this.ledService);
        }
        this.airQualityService = this.accessory.getServiceById(this.platform.Service.AirQualitySensor, 'AirQuality');
        if ((0, capabilities_1.shouldExposeDetectedService)('airQuality', this.configDev.airQualitySensor, capabilities.sensors.airQuality, autoExposeAvailableServices, disabledServices)) {
            (_c = this.airQualityService) !== null && _c !== void 0 ? _c : (this.airQualityService = this.accessory.addService(this.platform.Service.AirQualitySensor, `${this.device.name} Air Quality`, 'AirQuality'));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.PM2_5Density).onGet(this.getPM2_5Density.bind(this));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.PM10Density).onGet(this.getPM10Density.bind(this));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.VOCDensity).onGet(this.getVOCDensity.bind(this));
        }
        else if (this.airQualityService) {
            this.accessory.removeService(this.airQualityService);
            this.airQualityService = undefined;
        }
        this.temperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'Temperature');
        if ((0, capabilities_1.shouldExposeDetectedService)('temperature', this.configDev.temperatureSensor, capabilities.sensors.temperature, autoExposeAvailableServices, disabledServices)) {
            (_d = this.temperatureService) !== null && _d !== void 0 ? _d : (this.temperatureService = this.accessory.addService(this.platform.Service.TemperatureSensor, `${this.device.name} Temperature`, 'Temperature'));
            this.temperatureService
                .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
                .onGet(this.getCurrentTemperature.bind(this));
        }
        else if (this.temperatureService) {
            this.accessory.removeService(this.temperatureService);
            this.temperatureService = undefined;
        }
        this.humidityService = this.accessory.getServiceById(this.platform.Service.HumiditySensor, 'Humidity');
        if ((0, capabilities_1.shouldExposeDetectedService)('humidity', this.configDev.humiditySensor, capabilities.sensors.humidity, autoExposeAvailableServices, disabledServices)) {
            (_e = this.humidityService) !== null && _e !== void 0 ? _e : (this.humidityService = this.accessory.addService(this.platform.Service.HumiditySensor, `${this.device.name} Humidity`, 'Humidity'));
            this.humidityService
                .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
                .onGet(this.getCurrentRelativeHumidity.bind(this));
        }
        else if (this.humidityService) {
            this.accessory.removeService(this.humidityService);
            this.humidityService = undefined;
        }
        this.germShieldService = this.accessory.getServiceById(this.platform.Service.Switch, 'GermShield');
        if ((0, capabilities_1.shouldExposeService)('germShield', this.configDev.germShield, capabilities.controls.germShield, autoExposeAvailableServices, disabledServices)) {
            (_f = this.germShieldService) !== null && _f !== void 0 ? _f : (this.germShieldService = this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Germ Shield`, 'GermShield'));
            this.germShieldService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Germ Shield`);
            this.germShieldService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Germ Shield`);
            this.germShieldService
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.getGermShield.bind(this))
                .onSet(this.setGermShield.bind(this));
        }
        else if (this.germShieldService) {
            this.accessory.removeService(this.germShieldService);
        }
        this.nightModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'NightMode');
        if ((0, capabilities_1.shouldExposeService)('nightMode', this.configDev.nightMode, capabilities.controls.nightMode, autoExposeAvailableServices, disabledServices)) {
            (_g = this.nightModeService) !== null && _g !== void 0 ? _g : (this.nightModeService = this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Night Mode`, 'NightMode'));
            this.nightModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Night Mode`);
            this.nightModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Night Mode`);
            this.nightModeService
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.getNightMode.bind(this))
                .onSet(this.setNightMode.bind(this));
        }
        else if (this.nightModeService) {
            this.accessory.removeService(this.nightModeService);
        }
        this.device.on('stateUpdated', this.updateCharacteristics.bind(this));
    }
    updateCharacteristics(changedStates) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        for (const [k, v] of Object.entries(changedStates)) {
            this.platform.log.debug(`[${this.device.name}] ${k} changed to ${v}`);
            let updateState = false;
            let updateAirQuality = false;
            switch (k) {
                case 'standby':
                    updateState = true;
                    break;
                case 'automode':
                    this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.getTargetAirPurifierState());
                    break;
                case 'childlock':
                    if (this.supportsChildLock) {
                        this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.getLockPhysicalControls());
                    }
                    break;
                case 'fanspeed':
                case 'fsp0':
                    if (this.supportsFanSpeed) {
                        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
                        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
                        this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.getCurrentAirPurifierState());
                    }
                    break;
                case 'filterusage':
                    (_a = this.filterMaintenanceService) === null || _a === void 0 ? void 0 : _a.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, this.getFilterChangeIndication());
                    (_b = this.filterMaintenanceService) === null || _b === void 0 ? void 0 : _b.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, this.getFilterLifeLevel());
                    break;
                case 'temperature':
                    this.ensureTemperatureService();
                    (_c = this.temperatureService) === null || _c === void 0 ? void 0 : _c.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
                    break;
                case 'humidity':
                    this.ensureHumidityService();
                    (_d = this.humidityService) === null || _d === void 0 ? void 0 : _d.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getCurrentRelativeHumidity());
                    break;
                case 'brightness':
                    (_e = this.ledService) === null || _e === void 0 ? void 0 : _e.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
                    (_f = this.ledService) === null || _f === void 0 ? void 0 : _f.updateCharacteristic(this.platform.Characteristic.Brightness, this.getLedBrightness());
                    break;
                case 'pm2_5':
                    this.ensureAirQualityService();
                    (_g = this.airQualityService) === null || _g === void 0 ? void 0 : _g.updateCharacteristic(this.platform.Characteristic.PM2_5Density, this.getPM2_5Density());
                    updateAirQuality = true;
                    break;
                case 'pm10':
                    this.ensureAirQualityService();
                    (_h = this.airQualityService) === null || _h === void 0 ? void 0 : _h.updateCharacteristic(this.platform.Characteristic.PM10Density, this.getPM10Density());
                    updateAirQuality = true;
                    break;
                case 'voc':
                    this.ensureAirQualityService();
                    (_j = this.airQualityService) === null || _j === void 0 ? void 0 : _j.updateCharacteristic(this.platform.Characteristic.VOCDensity, this.getVOCDensity());
                    updateAirQuality = true;
                    break;
                case 'germshield':
                    (_k = this.germShieldService) === null || _k === void 0 ? void 0 : _k.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
                    break;
                case 'nightmode':
                    (_l = this.nightModeService) === null || _l === void 0 ? void 0 : _l.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
                    break;
            }
            if (updateState) {
                this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.getCurrentAirPurifierState());
                this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.getTargetAirPurifierState());
                if (this.supportsFanSpeed) {
                    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
                }
                (_m = this.ledService) === null || _m === void 0 ? void 0 : _m.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
                (_o = this.germShieldService) === null || _o === void 0 ? void 0 : _o.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
                (_p = this.nightModeService) === null || _p === void 0 ? void 0 : _p.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
            }
            if (updateAirQuality) {
                (_q = this.airQualityService) === null || _q === void 0 ? void 0 : _q.updateCharacteristic(this.platform.Characteristic.AirQuality, this.getAirQuality());
            }
        }
    }
    getActive() {
        return this.device.controlState.standby === false
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }
    async setActive(value) {
        this.platform.log.debug(`[${this.device.name}] Setting active to ${value}`);
        await this.device.setState('standby', value === this.platform.Characteristic.Active.INACTIVE);
    }
    getCurrentAirPurifierState() {
        if (this.device.controlState.standby === false) {
            return this.device.controlState.automode && this.getFanSpeedValue() === 0
                ? this.platform.Characteristic.CurrentAirPurifierState.IDLE
                : this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
        }
        return this.platform.Characteristic.CurrentAirPurifierState.INACTIVE;
    }
    getTargetAirPurifierState() {
        return this.device.controlState.automode
            ? this.platform.Characteristic.TargetAirPurifierState.AUTO
            : this.platform.Characteristic.TargetAirPurifierState.MANUAL;
    }
    async setTargetAirPurifierState(value) {
        this.platform.log.debug(`[${this.device.name}] Setting target air purifier state to ${value}`);
        if (!this.supportsAutoMode) {
            this.platform.log.warn(`[${this.device.name}] Ignoring auto mode change because this device did not report automode support.`);
            return;
        }
        await this.device.setState('automode', value === this.platform.Characteristic.TargetAirPurifierState.AUTO);
    }
    getLockPhysicalControls() {
        return this.device.controlState.childlock
            ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
            : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }
    async setLockPhysicalControls(value) {
        this.platform.log.debug(`[${this.device.name}] Setting lock physical controls to ${value}`);
        if (!this.supportsChildLock) {
            this.platform.log.warn(`[${this.device.name}] Ignoring child lock change because this device did not report childlock support.`);
            return;
        }
        await this.device.setState('childlock', value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
    }
    getRotationSpeed() {
        return this.device.controlState.standby === false ? (0, adapters_1.fanRawToPercent)(this.getFanSpeedValue(), this.getFanSpeedSpec()) : 0;
    }
    async setRotationSpeed(value) {
        if (!this.supportsFanSpeed) {
            this.platform.log.warn(`[${this.device.name}] Ignoring fan speed change because this device did not report fanspeed support.`);
            return;
        }
        const spec = this.getFanSpeedSpec();
        const attribute = spec.attribute;
        const rawValue = (0, adapters_1.fanPercentToRaw)(Number(value), spec);
        this.platform.log.info(`[${this.device.name}] Setting rotation speed: homekit=${value}, key=${attribute}, raw=${rawValue}`);
        await this.device.setState(attribute, rawValue);
    }
    getFilterChangeIndication() {
        return this.device.controlState.filterusage !== undefined && this.device.controlState.filterusage >= this.configDev.filterChangeLevel
            ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
            : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }
    getFilterLifeLevel() {
        return 100 - (this.device.controlState.filterusage || 0);
    }
    getCurrentTemperature() {
        return (0, capabilities_1.temperatureToCelsius)(this.device.sensorState.temperature, this.configDev.temperatureInputUnit);
    }
    getCurrentRelativeHumidity() {
        return this.device.sensorState.humidity || 0;
    }
    getLedOn() {
        return (this.device.controlState.brightness !== undefined &&
            this.device.controlState.brightness > 0 &&
            this.device.controlState.nightmode !== true);
    }
    async setLedOn(value) {
        this.platform.log.debug(`[${this.device.name}] Setting LED on to ${value}`);
        await this.device.setLedOn(value);
    }
    getLedBrightness() {
        return (0, capabilities_1.rawToPercent)(this.device.controlState.brightness, this.getBrightnessMax());
    }
    async setLedBrightness(value) {
        this.platform.log.debug(`[${this.device.name}] Setting LED brightness to ${value}`);
        await this.device.setState('brightness', (0, capabilities_1.percentToRaw)(Number(value), this.getBrightnessMax()));
    }
    getPM2_5Density() {
        return this.device.sensorState.pm2_5 || 0;
    }
    getPM10Density() {
        return this.device.sensorState.pm10 || 0;
    }
    getVOCDensity() {
        return this.device.sensorState.voc || 0;
    }
    getAirQuality() {
        if (this.device.sensorState.aqi === undefined) {
            return this.platform.Characteristic.AirQuality.UNKNOWN;
        }
        if (this.device.sensorState.aqi <= 50) {
            return this.platform.Characteristic.AirQuality.EXCELLENT;
        }
        else if (this.device.sensorState.aqi <= 100) {
            return this.platform.Characteristic.AirQuality.GOOD;
        }
        else if (this.device.sensorState.aqi <= 150) {
            return this.platform.Characteristic.AirQuality.FAIR;
        }
        else if (this.device.sensorState.aqi <= 200) {
            return this.platform.Characteristic.AirQuality.INFERIOR;
        }
        else {
            return this.platform.Characteristic.AirQuality.POOR;
        }
    }
    getGermShield() {
        return this.device.controlState.germshield === true;
    }
    async setGermShield(value) {
        this.platform.log.debug(`[${this.device.name}] Setting germ shield to ${value}`);
        await this.device.setState('germshield', value);
    }
    getNightMode() {
        return this.device.controlState.nightmode === true;
    }
    async setNightMode(value) {
        this.platform.log.debug(`[${this.device.name}] Setting night mode to ${value}`);
        await this.device.setState('nightmode', value);
    }
    getFanSpeedSpec() {
        var _a;
        const attribute = this.getFanSpeedAttribute();
        if (this.configDev.fanSpeedMax && this.configDev.fanSpeedMax > 0) {
            return {
                attribute,
                rawMax: this.configDev.fanSpeedMax,
            };
        }
        return ((_a = this.device.deviceMetadata.fanSpeed) !== null && _a !== void 0 ? _a : {
            attribute,
            rawMax: this.device.getObservedFanSpeedMax(),
        });
    }
    getFanSpeedValue() {
        const fanspeed = this.device.controlState.fanspeed;
        if (typeof fanspeed === 'number') {
            return fanspeed;
        }
        const fsp0 = this.device.controlState.fsp0;
        return typeof fsp0 === 'number' ? fsp0 : undefined;
    }
    getFanSpeedAttribute() {
        var _a, _b;
        return (_b = (_a = this.device.deviceMetadata.fanSpeed) === null || _a === void 0 ? void 0 : _a.attribute) !== null && _b !== void 0 ? _b : (this.device.controlState.fanspeed !== undefined ? 'fanspeed' : 'fsp0');
    }
    getBrightnessMax() {
        return (0, capabilities_1.brightnessMaxForDevice)(this.configDev, this.device.getObservedBrightnessMax());
    }
    ensureAirQualityService() {
        var _a;
        if (this.airQualityService) {
            return;
        }
        const capabilities = (0, capabilities_1.inferDeviceCapabilities)(this.device.controlState, this.device.sensorState);
        if (!(0, capabilities_1.shouldExposeDetectedService)('airQuality', this.configDev.airQualitySensor, capabilities.sensors.airQuality, this.platform.platformConfig.autoExposeAvailableServices, (_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : [])) {
            return;
        }
        this.airQualityService = this.accessory.addService(this.platform.Service.AirQualitySensor, `${this.device.name} Air Quality`, 'AirQuality');
        this.airQualityService.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
        this.airQualityService.getCharacteristic(this.platform.Characteristic.PM2_5Density).onGet(this.getPM2_5Density.bind(this));
        this.airQualityService.getCharacteristic(this.platform.Characteristic.PM10Density).onGet(this.getPM10Density.bind(this));
        this.airQualityService.getCharacteristic(this.platform.Characteristic.VOCDensity).onGet(this.getVOCDensity.bind(this));
    }
    ensureTemperatureService() {
        var _a;
        if (this.temperatureService) {
            return;
        }
        const capabilities = (0, capabilities_1.inferDeviceCapabilities)(this.device.controlState, this.device.sensorState);
        if (!(0, capabilities_1.shouldExposeDetectedService)('temperature', this.configDev.temperatureSensor, capabilities.sensors.temperature, this.platform.platformConfig.autoExposeAvailableServices, (_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : [])) {
            return;
        }
        this.temperatureService = this.accessory.addService(this.platform.Service.TemperatureSensor, `${this.device.name} Temperature`, 'Temperature');
        this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));
    }
    ensureHumidityService() {
        var _a;
        if (this.humidityService) {
            return;
        }
        const capabilities = (0, capabilities_1.inferDeviceCapabilities)(this.device.controlState, this.device.sensorState);
        if (!(0, capabilities_1.shouldExposeDetectedService)('humidity', this.configDev.humiditySensor, capabilities.sensors.humidity, this.platform.platformConfig.autoExposeAvailableServices, (_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : [])) {
            return;
        }
        this.humidityService = this.accessory.addService(this.platform.Service.HumiditySensor, `${this.device.name} Humidity`, 'Humidity');
        this.humidityService
            .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
            .onGet(this.getCurrentRelativeHumidity.bind(this));
    }
    removeCharacteristicIfPresent(service, characteristic) {
        if (service.testCharacteristic(characteristic)) {
            service.removeCharacteristic(service.getCharacteristic(characteristic));
        }
    }
}
exports.AirPurifierAccessory = AirPurifierAccessory;
//# sourceMappingURL=AirPurifierAccessory.js.map