"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirPurifierAccessory = void 0;
const capabilities_1 = require("../device/capabilities");
class AirPurifierAccessory {
    constructor(platform, accessory, device, configDev) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.platform = platform;
        this.accessory = accessory;
        this.device = device;
        this.configDev = configDev;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'BlueAir')
            .setCharacteristic(this.platform.Characteristic.Model, this.configDev.model || 'BlueAir Purifier')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.configDev.serialNumber || 'BlueAir Device');
        const capabilities = (0, capabilities_1.inferDeviceCapabilities)(this.device.state, this.device.sensorData);
        const autoExposeAvailableServices = this.platform.platformConfig.autoExposeAvailableServices;
        const disabledServices = (_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : [];
        this.service =
            this.accessory.getService(this.platform.Service.AirPurifier) || this.accessory.addService(this.platform.Service.AirPurifier);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.configDev.name);
        this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState).onGet(this.getCurrentAirPurifierState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
            .onGet(this.getTargetAirPurifierState.bind(this))
            .onSet(this.setTargetAirPurifierState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
            .onGet(this.getLockPhysicalControls.bind(this))
            .onSet(this.setLockPhysicalControls.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onGet(this.getRotationSpeed.bind(this))
            .onSet(this.setRotationSpeed.bind(this));
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
        if ((0, capabilities_1.shouldExposeService)('airQuality', this.configDev.airQualitySensor, capabilities.sensors.airQuality, autoExposeAvailableServices, disabledServices)) {
            (_c = this.airQualityService) !== null && _c !== void 0 ? _c : (this.airQualityService = this.accessory.addService(this.platform.Service.AirQualitySensor, `${this.device.name} Air Quality`, 'AirQuality'));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.PM2_5Density).onGet(this.getPM2_5Density.bind(this));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.PM10Density).onGet(this.getPM10Density.bind(this));
            this.airQualityService.getCharacteristic(this.platform.Characteristic.VOCDensity).onGet(this.getVOCDensity.bind(this));
        }
        else if (this.airQualityService) {
            this.accessory.removeService(this.airQualityService);
        }
        this.temperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'Temperature');
        if ((0, capabilities_1.shouldExposeService)('temperature', this.configDev.temperatureSensor, capabilities.sensors.temperature, autoExposeAvailableServices, disabledServices)) {
            (_d = this.temperatureService) !== null && _d !== void 0 ? _d : (this.temperatureService = this.accessory.addService(this.platform.Service.TemperatureSensor, `${this.device.name} Temperature`, 'Temperature'));
            this.temperatureService
                .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
                .onGet(this.getCurrentTemperature.bind(this));
        }
        else if (this.temperatureService) {
            this.accessory.removeService(this.temperatureService);
        }
        this.humidityService = this.accessory.getServiceById(this.platform.Service.HumiditySensor, 'Humidity');
        if ((0, capabilities_1.shouldExposeService)('humidity', this.configDev.humiditySensor, capabilities.sensors.humidity, autoExposeAvailableServices, disabledServices)) {
            (_e = this.humidityService) !== null && _e !== void 0 ? _e : (this.humidityService = this.accessory.addService(this.platform.Service.HumiditySensor, `${this.device.name} Humidity`, 'Humidity'));
            this.humidityService
                .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
                .onGet(this.getCurrentRelativeHumidity.bind(this));
        }
        else if (this.humidityService) {
            this.accessory.removeService(this.humidityService);
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
                    this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.getLockPhysicalControls());
                    break;
                case 'fanspeed':
                    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
                    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.getCurrentAirPurifierState());
                    break;
                case 'filterusage':
                    (_a = this.filterMaintenanceService) === null || _a === void 0 ? void 0 : _a.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, this.getFilterChangeIndication());
                    (_b = this.filterMaintenanceService) === null || _b === void 0 ? void 0 : _b.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, this.getFilterLifeLevel());
                    break;
                case 'temperature':
                    (_c = this.temperatureService) === null || _c === void 0 ? void 0 : _c.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
                    break;
                case 'humidity':
                    (_d = this.humidityService) === null || _d === void 0 ? void 0 : _d.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getCurrentRelativeHumidity());
                    break;
                case 'brightness':
                    (_e = this.ledService) === null || _e === void 0 ? void 0 : _e.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
                    (_f = this.ledService) === null || _f === void 0 ? void 0 : _f.updateCharacteristic(this.platform.Characteristic.Brightness, this.getLedBrightness());
                    break;
                case 'pm2_5':
                    (_g = this.airQualityService) === null || _g === void 0 ? void 0 : _g.updateCharacteristic(this.platform.Characteristic.PM2_5Density, this.getPM2_5Density());
                    updateAirQuality = true;
                    break;
                case 'pm10':
                    (_h = this.airQualityService) === null || _h === void 0 ? void 0 : _h.updateCharacteristic(this.platform.Characteristic.PM10Density, this.getPM10Density());
                    updateAirQuality = true;
                    break;
                case 'voc':
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
                this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
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
        return this.device.state.standby === false ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
    }
    async setActive(value) {
        this.platform.log.debug(`[${this.device.name}] Setting active to ${value}`);
        await this.device.setState('standby', value === this.platform.Characteristic.Active.INACTIVE);
    }
    getCurrentAirPurifierState() {
        if (this.device.state.standby === false) {
            return this.device.state.automode && this.device.state.fanspeed === 0
                ? this.platform.Characteristic.CurrentAirPurifierState.IDLE
                : this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
        }
        return this.platform.Characteristic.CurrentAirPurifierState.INACTIVE;
    }
    getTargetAirPurifierState() {
        return this.device.state.automode
            ? this.platform.Characteristic.TargetAirPurifierState.AUTO
            : this.platform.Characteristic.TargetAirPurifierState.MANUAL;
    }
    async setTargetAirPurifierState(value) {
        this.platform.log.debug(`[${this.device.name}] Setting target air purifier state to ${value}`);
        await this.device.setState('automode', value === this.platform.Characteristic.TargetAirPurifierState.AUTO);
    }
    getLockPhysicalControls() {
        return this.device.state.childlock
            ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
            : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }
    async setLockPhysicalControls(value) {
        this.platform.log.debug(`[${this.device.name}] Setting lock physical controls to ${value}`);
        await this.device.setState('childlock', value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
    }
    getRotationSpeed() {
        return this.device.state.standby === false ? (0, capabilities_1.rawToPercent)(this.device.state.fanspeed, this.getFanSpeedMax()) : 0;
    }
    async setRotationSpeed(value) {
        this.platform.log.debug(`[${this.device.name}] Setting rotation speed to ${value}`);
        await this.device.setState('fanspeed', (0, capabilities_1.percentToRaw)(Number(value), this.getFanSpeedMax()));
    }
    getFilterChangeIndication() {
        return this.device.state.filterusage !== undefined && this.device.state.filterusage >= this.configDev.filterChangeLevel
            ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
            : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }
    getFilterLifeLevel() {
        return 100 - (this.device.state.filterusage || 0);
    }
    getCurrentTemperature() {
        return (0, capabilities_1.temperatureToCelsius)(this.device.sensorData.temperature, this.configDev.temperatureInputUnit);
    }
    getCurrentRelativeHumidity() {
        return this.device.sensorData.humidity || 0;
    }
    getLedOn() {
        return this.device.state.brightness !== undefined && this.device.state.brightness > 0 && this.device.state.nightmode !== true;
    }
    async setLedOn(value) {
        this.platform.log.debug(`[${this.device.name}] Setting LED on to ${value}`);
        await this.device.setLedOn(value);
    }
    getLedBrightness() {
        return (0, capabilities_1.rawToPercent)(this.device.state.brightness, this.getBrightnessMax());
    }
    async setLedBrightness(value) {
        this.platform.log.debug(`[${this.device.name}] Setting LED brightness to ${value}`);
        await this.device.setState('brightness', (0, capabilities_1.percentToRaw)(Number(value), this.getBrightnessMax()));
    }
    getPM2_5Density() {
        return this.device.sensorData.pm2_5 || 0;
    }
    getPM10Density() {
        return this.device.sensorData.pm10 || 0;
    }
    getVOCDensity() {
        return this.device.sensorData.voc || 0;
    }
    getAirQuality() {
        if (this.device.sensorData.aqi === undefined) {
            return this.platform.Characteristic.AirQuality.UNKNOWN;
        }
        if (this.device.sensorData.aqi <= 50) {
            return this.platform.Characteristic.AirQuality.EXCELLENT;
        }
        else if (this.device.sensorData.aqi <= 100) {
            return this.platform.Characteristic.AirQuality.GOOD;
        }
        else if (this.device.sensorData.aqi <= 150) {
            return this.platform.Characteristic.AirQuality.FAIR;
        }
        else if (this.device.sensorData.aqi <= 200) {
            return this.platform.Characteristic.AirQuality.INFERIOR;
        }
        else {
            return this.platform.Characteristic.AirQuality.POOR;
        }
    }
    getGermShield() {
        return this.device.state.germshield === true;
    }
    async setGermShield(value) {
        this.platform.log.debug(`[${this.device.name}] Setting germ shield to ${value}`);
        await this.device.setState('germshield', value);
    }
    getNightMode() {
        return this.device.state.nightmode === true;
    }
    async setNightMode(value) {
        this.platform.log.debug(`[${this.device.name}] Setting night mode to ${value}`);
        await this.device.setState('nightmode', value);
    }
    getFanSpeedMax() {
        return (0, capabilities_1.fanSpeedMaxForDevice)(this.configDev, this.device.getObservedFanSpeedMax());
    }
    getBrightnessMax() {
        return (0, capabilities_1.brightnessMaxForDevice)(this.configDev, this.device.getObservedBrightnessMax());
    }
}
exports.AirPurifierAccessory = AirPurifierAccessory;
//# sourceMappingURL=AirPurifierAccessory.js.map