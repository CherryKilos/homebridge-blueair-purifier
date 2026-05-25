"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirPurifierAccessory = void 0;
const capabilities_1 = require("../device/capabilities");
const adapters_1 = require("../device/adapters");
const homekitNames_1 = require("./homekitNames");
const comfortPureControls_1 = require("../device/comfortPureControls");
class AirPurifierAccessory {
    constructor(platform, accessory, device, configDev) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        this.platform = platform;
        this.accessory = accessory;
        this.device = device;
        this.configDev = configDev;
        this.supportsAutoMode = false;
        this.supportsChildLock = false;
        this.supportsFanSpeed = false;
        this.supportsDisplayLight = false;
        this.supportsOscillation = false;
        this.supportsSleepTimer = false;
        this.lastDisplayBrightness = 100;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'BlueAir')
            .setCharacteristic(this.platform.Characteristic.Model, this.configDev.model || 'BlueAir Purifier')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.configDev.serialNumber || 'BlueAir Device');
        const capabilities = (0, capabilities_1.inferDeviceCapabilities)(this.device.controlState, this.device.sensorState);
        const autoExposeAvailableServices = this.platform.platformConfig.autoExposeAvailableServices;
        const disabledServices = (_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : [];
        const baseName = (0, homekitNames_1.sanitizeHomeKitName)(this.configDev.name || this.device.name);
        this.supportsAutoMode = capabilities.controls.autoMode;
        this.supportsChildLock = capabilities.controls.childLock;
        this.supportsFanSpeed = Boolean(this.device.deviceMetadata.fanSpeed);
        this.supportsDisplayLight = Boolean(this.device.deviceMetadata.displayBrightness);
        this.supportsOscillation = Boolean(this.device.deviceMetadata.oscillation);
        this.supportsSleepTimer = Boolean(this.device.deviceMetadata.sleepTimer);
        this.lastDisplayBrightness =
            typeof this.device.controlState.nmbrightness === 'number' && this.device.controlState.nmbrightness > 0
                ? this.device.controlState.nmbrightness
                : this.getDisplayBrightnessMax();
        this.service =
            this.accessory.getService(this.platform.Service.AirPurifier) || this.accessory.addService(this.platform.Service.AirPurifier);
        this.service.setCharacteristic(this.platform.Characteristic.Name, baseName);
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
        if (this.supportsOscillation && !disabledServices.includes('oscillation')) {
            this.service
                .getCharacteristic(this.platform.Characteristic.SwingMode)
                .onGet(this.getSwingMode.bind(this))
                .onSet(this.setSwingMode.bind(this));
        }
        else {
            this.removeCharacteristicIfPresent(this.service, this.platform.Characteristic.SwingMode);
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
            const ledName = (0, homekitNames_1.serviceName)(baseName, 'Led');
            (_b = this.ledService) !== null && _b !== void 0 ? _b : (this.ledService = this.accessory.addService(this.platform.Service.Lightbulb, ledName, 'Led'));
            this.ledService.setCharacteristic(this.platform.Characteristic.Name, ledName);
            this.removeCharacteristicIfPresent(this.ledService, this.platform.Characteristic.ConfiguredName);
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
            (_c = this.airQualityService) !== null && _c !== void 0 ? _c : (this.airQualityService = this.accessory.addService(this.platform.Service.AirQualitySensor, (0, homekitNames_1.serviceName)(baseName, 'Air Quality'), 'AirQuality'));
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
            (_d = this.temperatureService) !== null && _d !== void 0 ? _d : (this.temperatureService = this.accessory.addService(this.platform.Service.TemperatureSensor, (0, homekitNames_1.serviceName)(baseName, 'Temperature'), 'Temperature'));
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
            (_e = this.humidityService) !== null && _e !== void 0 ? _e : (this.humidityService = this.accessory.addService(this.platform.Service.HumiditySensor, (0, homekitNames_1.serviceName)(baseName, 'Humidity'), 'Humidity'));
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
            const germShieldName = (0, homekitNames_1.serviceName)(baseName, 'Germ Shield');
            (_f = this.germShieldService) !== null && _f !== void 0 ? _f : (this.germShieldService = this.accessory.addService(this.platform.Service.Switch, germShieldName, 'GermShield'));
            this.germShieldService.setCharacteristic(this.platform.Characteristic.Name, germShieldName);
            this.removeCharacteristicIfPresent(this.germShieldService, this.platform.Characteristic.ConfiguredName);
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
            const nightModeName = (0, homekitNames_1.serviceName)(baseName, 'Night Mode');
            (_g = this.nightModeService) !== null && _g !== void 0 ? _g : (this.nightModeService = this.accessory.addService(this.platform.Service.Switch, nightModeName, 'NightMode'));
            this.nightModeService.setCharacteristic(this.platform.Characteristic.Name, nightModeName);
            this.removeCharacteristicIfPresent(this.nightModeService, this.platform.Characteristic.ConfiguredName);
            this.nightModeService
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.getNightMode.bind(this))
                .onSet(this.setNightMode.bind(this));
        }
        else if (this.nightModeService) {
            this.accessory.removeService(this.nightModeService);
        }
        this.displayLightService = this.accessory.getServiceById(this.platform.Service.Lightbulb, 'DisplayLight');
        if (this.supportsDisplayLight && !disabledServices.includes('displayLight')) {
            const displayName = (0, homekitNames_1.serviceName)(baseName, 'Display');
            (_h = this.displayLightService) !== null && _h !== void 0 ? _h : (this.displayLightService = this.accessory.addService(this.platform.Service.Lightbulb, displayName, 'DisplayLight'));
            this.displayLightService.setCharacteristic(this.platform.Characteristic.Name, displayName);
            this.removeCharacteristicIfPresent(this.displayLightService, this.platform.Characteristic.ConfiguredName);
            this.displayLightService
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.getDisplayLightOn.bind(this))
                .onSet(this.setDisplayLightOn.bind(this));
            this.displayLightService
                .getCharacteristic(this.platform.Characteristic.Brightness)
                .onGet(this.getDisplayBrightness.bind(this))
                .onSet(this.setDisplayBrightness.bind(this));
        }
        else if (this.displayLightService) {
            this.accessory.removeService(this.displayLightService);
            this.displayLightService = undefined;
        }
        const legacySleepTimerSwitch = this.accessory.getServiceById(this.platform.Service.Switch, 'SleepTimer');
        if (legacySleepTimerSwitch) {
            this.accessory.removeService(legacySleepTimerSwitch);
        }
        this.sleepTimerService = this.accessory.getServiceById(this.platform.Service.Valve, 'SleepTimer');
        if (this.configDev.sleepTimer && this.supportsSleepTimer && !disabledServices.includes('sleepTimer')) {
            const sleepTimerName = (0, homekitNames_1.serviceName)(baseName, 'Sleep Timer');
            (_j = this.sleepTimerService) !== null && _j !== void 0 ? _j : (this.sleepTimerService = this.accessory.addService(this.platform.Service.Valve, sleepTimerName, 'SleepTimer'));
            this.sleepTimerService.setCharacteristic(this.platform.Characteristic.Name, sleepTimerName);
            this.sleepTimerService.setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.GENERIC_VALVE);
            this.sleepTimerService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(this.getSleepTimerActive.bind(this))
                .onSet(this.setSleepTimerActive.bind(this));
            this.sleepTimerService.getCharacteristic(this.platform.Characteristic.InUse).onGet(this.getSleepTimerInUse.bind(this));
            this.sleepTimerService
                .getCharacteristic(this.platform.Characteristic.SetDuration)
                .setProps({ minValue: 0, maxValue: 4 * 60 * 60, minStep: 30 * 60 })
                .onGet(this.getSleepTimerDuration.bind(this))
                .onSet(this.setSleepTimerDuration.bind(this));
            this.sleepTimerService
                .getCharacteristic(this.platform.Characteristic.RemainingDuration)
                .setProps({ minValue: 0, maxValue: 4 * 60 * 60, minStep: 1 })
                .onGet(this.getSleepTimerRemaining.bind(this));
        }
        else if (this.sleepTimerService) {
            this.accessory.removeService(this.sleepTimerService);
            this.sleepTimerService = undefined;
        }
        this.climateService = this.accessory.getServiceById(this.platform.Service.HeaterCooler, 'ComfortPureClimate');
        if (!this.shouldExposeComfortPureClimate() && this.climateService) {
            this.accessory.removeService(this.climateService);
            this.climateService = undefined;
        }
        this.ensureClimateService();
        this.device.on('stateUpdated', this.updateCharacteristics.bind(this));
    }
    updateCharacteristics(changedStates) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        for (const [k, v] of Object.entries(changedStates)) {
            this.platform.log.debug(`[${this.device.name}] ${k} changed to ${v}`);
            let updateState = false;
            let updateAirQuality = false;
            switch (k) {
                case 'standby':
                    updateState = true;
                    this.updateClimateCharacteristics();
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
                    this.updateClimateCharacteristics();
                    break;
                case 'filterusage':
                    (_a = this.filterMaintenanceService) === null || _a === void 0 ? void 0 : _a.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, this.getFilterChangeIndication());
                    (_b = this.filterMaintenanceService) === null || _b === void 0 ? void 0 : _b.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, this.getFilterLifeLevel());
                    break;
                case 'temperature':
                    this.ensureTemperatureService();
                    (_c = this.temperatureService) === null || _c === void 0 ? void 0 : _c.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
                    this.ensureClimateService();
                    this.updateClimateCharacteristics();
                    break;
                case 'humidity':
                    this.ensureHumidityService();
                    (_d = this.humidityService) === null || _d === void 0 ? void 0 : _d.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getCurrentRelativeHumidity());
                    break;
                case 'brightness':
                    (_e = this.ledService) === null || _e === void 0 ? void 0 : _e.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
                    (_f = this.ledService) === null || _f === void 0 ? void 0 : _f.updateCharacteristic(this.platform.Characteristic.Brightness, this.getLedBrightness());
                    break;
                case 'nmbrightness':
                    (_g = this.displayLightService) === null || _g === void 0 ? void 0 : _g.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayLightOn());
                    (_h = this.displayLightService) === null || _h === void 0 ? void 0 : _h.updateCharacteristic(this.platform.Characteristic.Brightness, this.getDisplayBrightness());
                    break;
                case 'pm2_5':
                    this.ensureAirQualityService();
                    (_j = this.airQualityService) === null || _j === void 0 ? void 0 : _j.updateCharacteristic(this.platform.Characteristic.PM2_5Density, this.getPM2_5Density());
                    updateAirQuality = true;
                    break;
                case 'pm10':
                    this.ensureAirQualityService();
                    (_k = this.airQualityService) === null || _k === void 0 ? void 0 : _k.updateCharacteristic(this.platform.Characteristic.PM10Density, this.getPM10Density());
                    updateAirQuality = true;
                    break;
                case 'voc':
                    this.ensureAirQualityService();
                    (_l = this.airQualityService) === null || _l === void 0 ? void 0 : _l.updateCharacteristic(this.platform.Characteristic.VOCDensity, this.getVOCDensity());
                    updateAirQuality = true;
                    break;
                case 'germshield':
                    (_m = this.germShieldService) === null || _m === void 0 ? void 0 : _m.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
                    break;
                case 'nightmode':
                    (_o = this.nightModeService) === null || _o === void 0 ? void 0 : _o.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
                    break;
                case 'osc':
                case 'oscstate':
                    if (this.supportsOscillation) {
                        this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
                    }
                    (_p = this.climateService) === null || _p === void 0 ? void 0 : _p.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
                    break;
                case 'timstate':
                case 'timdur':
                case 'timl':
                case 'timts':
                    (_q = this.sleepTimerService) === null || _q === void 0 ? void 0 : _q.updateCharacteristic(this.platform.Characteristic.Active, this.getSleepTimerActive());
                    (_r = this.sleepTimerService) === null || _r === void 0 ? void 0 : _r.updateCharacteristic(this.platform.Characteristic.InUse, this.getSleepTimerInUse());
                    (_s = this.sleepTimerService) === null || _s === void 0 ? void 0 : _s.updateCharacteristic(this.platform.Characteristic.SetDuration, this.getSleepTimerDuration());
                    (_t = this.sleepTimerService) === null || _t === void 0 ? void 0 : _t.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getSleepTimerRemaining());
                    break;
                case 'mainmode':
                case 'heattemp':
                case 'heatfs':
                case 'coolfs':
                case 'heatsubmode':
                case 'coolsubmode':
                case 'apsubmode':
                    this.updateClimateCharacteristics();
                    break;
            }
            if (updateState) {
                this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.getCurrentAirPurifierState());
                this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.getTargetAirPurifierState());
                if (this.supportsFanSpeed) {
                    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
                }
                (_u = this.ledService) === null || _u === void 0 ? void 0 : _u.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
                (_v = this.germShieldService) === null || _v === void 0 ? void 0 : _v.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
                (_w = this.nightModeService) === null || _w === void 0 ? void 0 : _w.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
                (_x = this.displayLightService) === null || _x === void 0 ? void 0 : _x.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayLightOn());
                this.updateClimateCharacteristics();
            }
            if (updateAirQuality) {
                (_y = this.airQualityService) === null || _y === void 0 ? void 0 : _y.updateCharacteristic(this.platform.Characteristic.AirQuality, this.getAirQuality());
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
    getSwingMode() {
        return (0, comfortPureControls_1.booleanStateValue)(this.device.controlState, 'osc') || (0, comfortPureControls_1.booleanStateValue)(this.device.controlState, 'oscstate')
            ? this.platform.Characteristic.SwingMode.SWING_ENABLED
            : this.platform.Characteristic.SwingMode.SWING_DISABLED;
    }
    async setSwingMode(value) {
        if (!this.supportsOscillation) {
            this.platform.log.warn(`[${this.device.name}] Ignoring oscillation change because this device did not report osc support.`);
            return;
        }
        const enabled = value === this.platform.Characteristic.SwingMode.SWING_ENABLED;
        const rawValue = (0, comfortPureControls_1.booleanWriteValue)(this.device.controlState, 'osc', enabled);
        this.platform.log.info(`[${this.device.name}] Setting oscillation: homekit=${value}, key=osc, raw=${rawValue}`);
        await this.device.setState('osc', rawValue);
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
    getDisplayLightOn() {
        return typeof this.device.controlState.nmbrightness === 'number' && this.device.controlState.nmbrightness > 0;
    }
    async setDisplayLightOn(value) {
        if (!this.supportsDisplayLight) {
            this.platform.log.warn(`[${this.device.name}] Ignoring display light change because this device did not report nmbrightness support.`);
            return;
        }
        if (!value) {
            this.lastDisplayBrightness = (0, comfortPureControls_1.numericStateValue)(this.device.controlState, 'nmbrightness') || this.lastDisplayBrightness;
            this.platform.log.info(`[${this.device.name}] Setting display light: homekit=${value}, key=nmbrightness, raw=0`);
            await this.device.setState('nmbrightness', 0);
            return;
        }
        const rawValue = this.lastDisplayBrightness > 0 ? this.lastDisplayBrightness : this.getDisplayBrightnessMax();
        this.platform.log.info(`[${this.device.name}] Setting display light: homekit=${value}, key=nmbrightness, raw=${rawValue}`);
        await this.device.setState('nmbrightness', rawValue);
    }
    getDisplayBrightness() {
        return (0, capabilities_1.rawToPercent)((0, comfortPureControls_1.numericStateValue)(this.device.controlState, 'nmbrightness'), this.getDisplayBrightnessMax());
    }
    async setDisplayBrightness(value) {
        if (!this.supportsDisplayLight) {
            this.platform.log.warn(`[${this.device.name}] Ignoring display brightness change because this device did not report nmbrightness support.`);
            return;
        }
        const rawValue = (0, capabilities_1.percentToRaw)(Number(value), this.getDisplayBrightnessMax());
        this.platform.log.info(`[${this.device.name}] Setting display brightness: homekit=${value}, key=nmbrightness, raw=${rawValue}`);
        if (rawValue > 0) {
            this.lastDisplayBrightness = rawValue;
        }
        await this.device.setState('nmbrightness', rawValue);
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
    getSleepTimerActive() {
        return (0, comfortPureControls_1.booleanStateValue)(this.device.controlState, 'timstate')
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }
    getSleepTimerInUse() {
        return (0, comfortPureControls_1.booleanStateValue)(this.device.controlState, 'timstate')
            ? this.platform.Characteristic.InUse.IN_USE
            : this.platform.Characteristic.InUse.NOT_IN_USE;
    }
    async setSleepTimerActive(value) {
        if (!this.supportsSleepTimer) {
            this.platform.log.warn(`[${this.device.name}] Ignoring sleep timer change because this device did not report timer support.`);
            return;
        }
        const enabled = value === this.platform.Characteristic.Active.ACTIVE;
        if (enabled) {
            const duration = (0, comfortPureControls_1.timerDurationSeconds)(this.device.controlState);
            this.platform.log.info(`[${this.device.name}] Setting sleep timer duration: homekit=${duration}, key=timdur, raw=${duration}`);
            await this.device.setState('timdur', duration);
        }
        const rawValue = (0, comfortPureControls_1.booleanWriteValue)(this.device.controlState, 'timstate', enabled);
        this.platform.log.info(`[${this.device.name}] Setting sleep timer: homekit=${value}, key=timstate, raw=${rawValue}`);
        await this.device.setState('timstate', rawValue);
    }
    getSleepTimerDuration() {
        return (0, comfortPureControls_1.timerDurationSeconds)(this.device.controlState);
    }
    async setSleepTimerDuration(value) {
        if (!this.supportsSleepTimer) {
            this.platform.log.warn(`[${this.device.name}] Ignoring sleep timer duration because this device did not report timer support.`);
            return;
        }
        const rawValue = (0, comfortPureControls_1.nearestTimerPresetSeconds)(Number(value));
        this.platform.log.info(`[${this.device.name}] Setting sleep timer duration: homekit=${value}, key=timdur, raw=${rawValue}`);
        await this.device.setState('timdur', rawValue);
    }
    getSleepTimerRemaining() {
        return (0, comfortPureControls_1.timerRemainingSeconds)(this.device.controlState);
    }
    getClimateActive() {
        return this.getActive();
    }
    async setClimateActive(value) {
        await this.setActive(value);
    }
    getCurrentHeaterCoolerState() {
        if (this.device.controlState.standby !== false) {
            return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        }
        switch ((0, comfortPureControls_1.numericStateValue)(this.device.controlState, 'mainmode')) {
            case comfortPureControls_1.COMFORT_PURE_MAIN_MODE.HEAT:
                return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
            case comfortPureControls_1.COMFORT_PURE_MAIN_MODE.COOL:
                return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
            default:
                return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
    }
    getTargetHeaterCoolerState() {
        switch ((0, comfortPureControls_1.numericStateValue)(this.device.controlState, 'mainmode')) {
            case comfortPureControls_1.COMFORT_PURE_MAIN_MODE.HEAT:
                return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
            case comfortPureControls_1.COMFORT_PURE_MAIN_MODE.COOL:
                return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
            default:
                return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        }
    }
    async setTargetHeaterCoolerState(value) {
        const target = value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT
            ? comfortPureControls_1.COMFORT_PURE_MAIN_MODE.HEAT
            : value === this.platform.Characteristic.TargetHeaterCoolerState.COOL
                ? comfortPureControls_1.COMFORT_PURE_MAIN_MODE.COOL
                : comfortPureControls_1.COMFORT_PURE_MAIN_MODE.FAN_ONLY;
        this.platform.log.info(`[${this.device.name}] Setting climate mode: homekit=${value}, key=mainmode, raw=${target}`);
        await this.device.setState('mainmode', target);
    }
    getHeatingThresholdTemperature() {
        var _a;
        return (_a = (0, comfortPureControls_1.blueairTemperatureToCelsius)((0, comfortPureControls_1.numericStateValue)(this.device.controlState, 'heattemp'))) !== null && _a !== void 0 ? _a : 21;
    }
    async setHeatingThresholdTemperature(value) {
        const celsius = (0, comfortPureControls_1.clampClimateSetpoint)(Number(value));
        const rawValue = (0, comfortPureControls_1.celsiusToBlueairSetpoint)(celsius);
        this.platform.log.info(`[${this.device.name}] Setting heat setpoint: homekit=${value}, key=heattemp, raw=${rawValue}`);
        await this.device.setState('heattemp', rawValue);
    }
    getClimateRotationSpeed() {
        const rawValue = (0, comfortPureControls_1.numericStateValue)(this.device.controlState, this.getClimateFanSpeedAttribute());
        return (0, adapters_1.fanRawToPercent)(rawValue, this.getFanSpeedSpec());
    }
    async setClimateRotationSpeed(value) {
        const attribute = this.getClimateFanSpeedAttribute();
        const rawValue = (0, adapters_1.fanPercentToRaw)(Number(value), this.getFanSpeedSpec());
        this.platform.log.info(`[${this.device.name}] Setting climate fan speed: homekit=${value}, key=${attribute}, raw=${rawValue}`);
        await this.device.setState(attribute, rawValue);
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
    getDisplayBrightnessMax() {
        var _a, _b;
        if (this.configDev.displayBrightnessMax && this.configDev.displayBrightnessMax > 0) {
            return this.configDev.displayBrightnessMax;
        }
        return (_b = (_a = this.device.deviceMetadata.displayBrightness) === null || _a === void 0 ? void 0 : _a.rawMax) !== null && _b !== void 0 ? _b : 100;
    }
    getClimateFanSpeedAttribute() {
        var _a, _b, _c, _d, _e, _f;
        switch ((0, comfortPureControls_1.numericStateValue)(this.device.controlState, 'mainmode')) {
            case comfortPureControls_1.COMFORT_PURE_MAIN_MODE.HEAT:
                return (_b = (_a = this.device.deviceMetadata.climate) === null || _a === void 0 ? void 0 : _a.heatFanAttribute) !== null && _b !== void 0 ? _b : 'heatfs';
            case comfortPureControls_1.COMFORT_PURE_MAIN_MODE.COOL:
                return (_d = (_c = this.device.deviceMetadata.climate) === null || _c === void 0 ? void 0 : _c.coolFanAttribute) !== null && _d !== void 0 ? _d : 'coolfs';
            default:
                return (_f = (_e = this.device.deviceMetadata.climate) === null || _e === void 0 ? void 0 : _e.fanFanAttribute) !== null && _f !== void 0 ? _f : 'fsp0';
        }
    }
    shouldExposeComfortPureClimate() {
        var _a;
        return (this.configDev.comfortPureClimateMode === 'gated' &&
            !((_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : []).includes('comfortPureClimate') &&
            Boolean(this.device.deviceMetadata.climate) &&
            this.device.sensorState.temperature !== undefined);
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
        this.airQualityService = this.accessory.addService(this.platform.Service.AirQualitySensor, (0, homekitNames_1.serviceName)(this.configDev.name || this.device.name, 'Air Quality'), 'AirQuality');
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
        this.temperatureService = this.accessory.addService(this.platform.Service.TemperatureSensor, (0, homekitNames_1.serviceName)(this.configDev.name || this.device.name, 'Temperature'), 'Temperature');
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
        this.humidityService = this.accessory.addService(this.platform.Service.HumiditySensor, (0, homekitNames_1.serviceName)(this.configDev.name || this.device.name, 'Humidity'), 'Humidity');
        this.humidityService
            .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
            .onGet(this.getCurrentRelativeHumidity.bind(this));
    }
    ensureClimateService() {
        var _a;
        if (this.climateService || !this.shouldExposeComfortPureClimate()) {
            return;
        }
        this.climateService = this.accessory.addService(this.platform.Service.HeaterCooler, (0, homekitNames_1.serviceName)(this.configDev.name || this.device.name, 'Climate'), 'ComfortPureClimate');
        this.climateService
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getClimateActive.bind(this))
            .onSet(this.setClimateActive.bind(this));
        this.climateService
            .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.climateService
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onGet(this.getTargetHeaterCoolerState.bind(this))
            .onSet(this.setTargetHeaterCoolerState.bind(this));
        this.climateService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));
        this.climateService
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .setProps({ minValue: 10, maxValue: 35, minStep: 0.5 })
            .onGet(this.getHeatingThresholdTemperature.bind(this))
            .onSet(this.setHeatingThresholdTemperature.bind(this));
        this.climateService
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onGet(this.getClimateRotationSpeed.bind(this))
            .onSet(this.setClimateRotationSpeed.bind(this));
        if (this.supportsOscillation && !((_a = this.configDev.disabledServices) !== null && _a !== void 0 ? _a : []).includes('oscillation')) {
            this.climateService
                .getCharacteristic(this.platform.Characteristic.SwingMode)
                .onGet(this.getSwingMode.bind(this))
                .onSet(this.setSwingMode.bind(this));
        }
    }
    updateClimateCharacteristics() {
        if (!this.climateService) {
            return;
        }
        this.climateService.updateCharacteristic(this.platform.Characteristic.Active, this.getClimateActive());
        this.climateService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
        this.climateService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
        this.climateService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
        this.climateService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
        this.climateService.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getClimateRotationSpeed());
        if (this.supportsOscillation) {
            this.climateService.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
        }
    }
    removeCharacteristicIfPresent(service, characteristic) {
        const existing = service.characteristics.find((serviceCharacteristic) => serviceCharacteristic.UUID === characteristic.UUID);
        if (existing) {
            service.removeCharacteristic(existing);
        }
    }
}
exports.AirPurifierAccessory = AirPurifierAccessory;
//# sourceMappingURL=AirPurifierAccessory.js.map