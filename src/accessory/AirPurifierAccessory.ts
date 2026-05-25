import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BlueAirPlatform } from '../platform';
import { BlueAirDevice } from '../device/BlueAirDevice';
import { DeviceConfig } from '../platformUtils';
import { FullBlueAirDeviceState } from '../api/BlueAirAwsApi';
import {
  brightnessMaxForDevice,
  inferDeviceCapabilities,
  percentToRaw,
  rawToPercent,
  shouldExposeDetectedService,
  shouldExposeService,
  temperatureToCelsius,
} from '../device/capabilities';
import { FanSpeedWriteSpec, fanPercentToRaw, fanRawToPercent } from '../device/adapters';
import { sanitizeHomeKitName, serviceName } from './homekitNames';
import {
  blueairTemperatureToCelsius,
  booleanStateValue,
  booleanWriteValue,
  celsiusToBlueairSetpoint,
  clampClimateSetpoint,
  COMFORT_PURE_MAIN_MODE,
  nearestTimerPresetSeconds,
  numericStateValue,
  timerDurationSeconds,
  timerRemainingSeconds,
} from '../device/comfortPureControls';

export class AirPurifierAccessory {
  private service: Service;
  private filterMaintenanceService?: Service;
  private ledService?: Service;
  private airQualityService?: Service;
  private temperatureService?: Service;
  private humidityService?: Service;
  private germShieldService?: Service;
  private nightModeService?: Service;
  private displayLightService?: Service;
  private sleepTimerService?: Service;
  private climateService?: Service;
  private supportsAutoMode = false;
  private supportsChildLock = false;
  private supportsFanSpeed = false;
  private supportsDisplayLight = false;
  private supportsOscillation = false;
  private supportsSleepTimer = false;
  private lastDisplayBrightness = 100;

  constructor(
    protected readonly platform: BlueAirPlatform,
    protected readonly accessory: PlatformAccessory,
    protected readonly device: BlueAirDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'BlueAir')
      .setCharacteristic(this.platform.Characteristic.Model, this.configDev.model || 'BlueAir Purifier')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.configDev.serialNumber || 'BlueAir Device');

    const capabilities = inferDeviceCapabilities(this.device.controlState, this.device.sensorState);
    const autoExposeAvailableServices = this.platform.platformConfig.autoExposeAvailableServices;
    const disabledServices = this.configDev.disabledServices ?? [];
    const baseName = sanitizeHomeKitName(this.configDev.name || this.device.name);
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
    } else {
      this.removeCharacteristicIfPresent(this.service, this.platform.Characteristic.LockPhysicalControls);
    }

    if (this.supportsFanSpeed) {
      this.service
        .getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(this.getRotationSpeed.bind(this))
        .onSet(this.setRotationSpeed.bind(this));
    } else {
      this.removeCharacteristicIfPresent(this.service, this.platform.Characteristic.RotationSpeed);
    }

    if (this.supportsOscillation && !disabledServices.includes('oscillation')) {
      this.service
        .getCharacteristic(this.platform.Characteristic.SwingMode)
        .onGet(this.getSwingMode.bind(this))
        .onSet(this.setSwingMode.bind(this));
    } else {
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
    if (shouldExposeService('led', this.configDev.led, capabilities.controls.brightness, autoExposeAvailableServices, disabledServices)) {
      const ledName = serviceName(baseName, 'Led');
      this.ledService ??= this.accessory.addService(this.platform.Service.Lightbulb, ledName, 'Led');
      this.ledService.setCharacteristic(this.platform.Characteristic.Name, ledName);
      this.removeCharacteristicIfPresent(this.ledService, this.platform.Characteristic.ConfiguredName);
      this.ledService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getLedOn.bind(this)).onSet(this.setLedOn.bind(this));
      this.ledService
        .getCharacteristic(this.platform.Characteristic.Brightness)
        .onGet(this.getLedBrightness.bind(this))
        .onSet(this.setLedBrightness.bind(this));
    } else if (this.ledService) {
      this.accessory.removeService(this.ledService);
    }

    this.airQualityService = this.accessory.getServiceById(this.platform.Service.AirQualitySensor, 'AirQuality');
    if (
      shouldExposeDetectedService(
        'airQuality',
        this.configDev.airQualitySensor,
        capabilities.sensors.airQuality,
        autoExposeAvailableServices,
        disabledServices,
      )
    ) {
      this.airQualityService ??= this.accessory.addService(
        this.platform.Service.AirQualitySensor,
        serviceName(baseName, 'Air Quality'),
        'AirQuality',
      );
      this.airQualityService.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
      this.airQualityService.getCharacteristic(this.platform.Characteristic.PM2_5Density).onGet(this.getPM2_5Density.bind(this));
      this.airQualityService.getCharacteristic(this.platform.Characteristic.PM10Density).onGet(this.getPM10Density.bind(this));
      this.airQualityService.getCharacteristic(this.platform.Characteristic.VOCDensity).onGet(this.getVOCDensity.bind(this));
    } else if (this.airQualityService) {
      this.accessory.removeService(this.airQualityService);
      this.airQualityService = undefined;
    }

    this.temperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'Temperature');
    if (
      shouldExposeDetectedService(
        'temperature',
        this.configDev.temperatureSensor,
        capabilities.sensors.temperature,
        autoExposeAvailableServices,
        disabledServices,
      )
    ) {
      this.temperatureService ??= this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        serviceName(baseName, 'Temperature'),
        'Temperature',
      );
      this.temperatureService
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this));
    } else if (this.temperatureService) {
      this.accessory.removeService(this.temperatureService);
      this.temperatureService = undefined;
    }

    this.humidityService = this.accessory.getServiceById(this.platform.Service.HumiditySensor, 'Humidity');
    if (
      shouldExposeDetectedService(
        'humidity',
        this.configDev.humiditySensor,
        capabilities.sensors.humidity,
        autoExposeAvailableServices,
        disabledServices,
      )
    ) {
      this.humidityService ??= this.accessory.addService(
        this.platform.Service.HumiditySensor,
        serviceName(baseName, 'Humidity'),
        'Humidity',
      );
      this.humidityService
        .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(this.getCurrentRelativeHumidity.bind(this));
    } else if (this.humidityService) {
      this.accessory.removeService(this.humidityService);
      this.humidityService = undefined;
    }

    this.germShieldService = this.accessory.getServiceById(this.platform.Service.Switch, 'GermShield');
    if (
      shouldExposeService(
        'germShield',
        this.configDev.germShield,
        capabilities.controls.germShield,
        autoExposeAvailableServices,
        disabledServices,
      )
    ) {
      const germShieldName = serviceName(baseName, 'Germ Shield');
      this.germShieldService ??= this.accessory.addService(this.platform.Service.Switch, germShieldName, 'GermShield');
      this.germShieldService.setCharacteristic(this.platform.Characteristic.Name, germShieldName);
      this.removeCharacteristicIfPresent(this.germShieldService, this.platform.Characteristic.ConfiguredName);
      this.germShieldService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getGermShield.bind(this))
        .onSet(this.setGermShield.bind(this));
    } else if (this.germShieldService) {
      this.accessory.removeService(this.germShieldService);
    }

    this.nightModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'NightMode');
    if (
      shouldExposeService(
        'nightMode',
        this.configDev.nightMode,
        capabilities.controls.nightMode,
        autoExposeAvailableServices,
        disabledServices,
      )
    ) {
      const nightModeName = serviceName(baseName, 'Night Mode');
      this.nightModeService ??= this.accessory.addService(this.platform.Service.Switch, nightModeName, 'NightMode');
      this.nightModeService.setCharacteristic(this.platform.Characteristic.Name, nightModeName);
      this.removeCharacteristicIfPresent(this.nightModeService, this.platform.Characteristic.ConfiguredName);
      this.nightModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getNightMode.bind(this))
        .onSet(this.setNightMode.bind(this));
    } else if (this.nightModeService) {
      this.accessory.removeService(this.nightModeService);
    }

    this.displayLightService = this.accessory.getServiceById(this.platform.Service.Lightbulb, 'DisplayLight');
    if (this.supportsDisplayLight && !disabledServices.includes('displayLight')) {
      const displayName = serviceName(baseName, 'Display');
      this.displayLightService ??= this.accessory.addService(this.platform.Service.Lightbulb, displayName, 'DisplayLight');
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
    } else if (this.displayLightService) {
      this.accessory.removeService(this.displayLightService);
      this.displayLightService = undefined;
    }

    const legacySleepTimerSwitch = this.accessory.getServiceById(this.platform.Service.Switch, 'SleepTimer');
    if (legacySleepTimerSwitch) {
      this.accessory.removeService(legacySleepTimerSwitch);
    }

    this.sleepTimerService = this.accessory.getServiceById(this.platform.Service.Valve, 'SleepTimer');
    if (this.configDev.sleepTimer && this.supportsSleepTimer && !disabledServices.includes('sleepTimer')) {
      const sleepTimerName = serviceName(baseName, 'Sleep Timer');
      this.sleepTimerService ??= this.accessory.addService(this.platform.Service.Valve, sleepTimerName, 'SleepTimer');
      this.sleepTimerService.setCharacteristic(this.platform.Characteristic.Name, sleepTimerName);
      this.sleepTimerService.setCharacteristic(
        this.platform.Characteristic.ValveType,
        this.platform.Characteristic.ValveType.GENERIC_VALVE,
      );
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
    } else if (this.sleepTimerService) {
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

  updateCharacteristics(changedStates: Partial<FullBlueAirDeviceState>) {
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
          this.filterMaintenanceService?.updateCharacteristic(
            this.platform.Characteristic.FilterChangeIndication,
            this.getFilterChangeIndication(),
          );
          this.filterMaintenanceService?.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, this.getFilterLifeLevel());
          break;
        case 'temperature':
          this.ensureTemperatureService();
          this.temperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
          this.ensureClimateService();
          this.updateClimateCharacteristics();
          break;
        case 'humidity':
          this.ensureHumidityService();
          this.humidityService?.updateCharacteristic(
            this.platform.Characteristic.CurrentRelativeHumidity,
            this.getCurrentRelativeHumidity(),
          );
          break;
        case 'brightness':
          this.ledService?.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
          this.ledService?.updateCharacteristic(this.platform.Characteristic.Brightness, this.getLedBrightness());
          break;
        case 'nmbrightness':
          this.displayLightService?.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayLightOn());
          this.displayLightService?.updateCharacteristic(this.platform.Characteristic.Brightness, this.getDisplayBrightness());
          break;
        case 'pm2_5':
          this.ensureAirQualityService();
          this.airQualityService?.updateCharacteristic(this.platform.Characteristic.PM2_5Density, this.getPM2_5Density());
          updateAirQuality = true;
          break;
        case 'pm10':
          this.ensureAirQualityService();
          this.airQualityService?.updateCharacteristic(this.platform.Characteristic.PM10Density, this.getPM10Density());
          updateAirQuality = true;
          break;
        case 'voc':
          this.ensureAirQualityService();
          this.airQualityService?.updateCharacteristic(this.platform.Characteristic.VOCDensity, this.getVOCDensity());
          updateAirQuality = true;
          break;
        case 'germshield':
          this.germShieldService?.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
          break;
        case 'nightmode':
          this.nightModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
          break;
        case 'osc':
        case 'oscstate':
          if (this.supportsOscillation) {
            this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
          }
          this.climateService?.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
          break;
        case 'timstate':
        case 'timdur':
        case 'timl':
        case 'timts':
          this.sleepTimerService?.updateCharacteristic(this.platform.Characteristic.Active, this.getSleepTimerActive());
          this.sleepTimerService?.updateCharacteristic(this.platform.Characteristic.InUse, this.getSleepTimerInUse());
          this.sleepTimerService?.updateCharacteristic(this.platform.Characteristic.SetDuration, this.getSleepTimerDuration());
          this.sleepTimerService?.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getSleepTimerRemaining());
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
        this.ledService?.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
        this.germShieldService?.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
        this.nightModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
        this.displayLightService?.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayLightOn());
        this.updateClimateCharacteristics();
      }

      if (updateAirQuality) {
        this.airQualityService?.updateCharacteristic(this.platform.Characteristic.AirQuality, this.getAirQuality());
      }
    }
  }

  getActive(): CharacteristicValue {
    return this.device.controlState.standby === false
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting active to ${value}`);
    await this.device.setState('standby', value === this.platform.Characteristic.Active.INACTIVE);
  }

  getCurrentAirPurifierState(): CharacteristicValue {
    if (this.device.controlState.standby === false) {
      return this.device.controlState.automode && this.getFanSpeedValue() === 0
        ? this.platform.Characteristic.CurrentAirPurifierState.IDLE
        : this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    }

    return this.platform.Characteristic.CurrentAirPurifierState.INACTIVE;
  }

  getTargetAirPurifierState(): CharacteristicValue {
    return this.device.controlState.automode
      ? this.platform.Characteristic.TargetAirPurifierState.AUTO
      : this.platform.Characteristic.TargetAirPurifierState.MANUAL;
  }

  async setTargetAirPurifierState(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting target air purifier state to ${value}`);
    if (!this.supportsAutoMode) {
      this.platform.log.warn(`[${this.device.name}] Ignoring auto mode change because this device did not report automode support.`);
      return;
    }
    await this.device.setState('automode', value === this.platform.Characteristic.TargetAirPurifierState.AUTO);
  }

  getLockPhysicalControls(): CharacteristicValue {
    return this.device.controlState.childlock
      ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
      : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
  }

  async setLockPhysicalControls(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting lock physical controls to ${value}`);
    if (!this.supportsChildLock) {
      this.platform.log.warn(`[${this.device.name}] Ignoring child lock change because this device did not report childlock support.`);
      return;
    }
    await this.device.setState('childlock', value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
  }

  getRotationSpeed(): CharacteristicValue {
    return this.device.controlState.standby === false ? fanRawToPercent(this.getFanSpeedValue(), this.getFanSpeedSpec()) : 0;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    if (!this.supportsFanSpeed) {
      this.platform.log.warn(`[${this.device.name}] Ignoring fan speed change because this device did not report fanspeed support.`);
      return;
    }

    const spec = this.getFanSpeedSpec();
    const attribute = spec.attribute;
    const rawValue = fanPercentToRaw(Number(value), spec);
    this.platform.log.info(`[${this.device.name}] Setting rotation speed: homekit=${value}, key=${attribute}, raw=${rawValue}`);
    await this.device.setState(attribute, rawValue);
  }

  getSwingMode(): CharacteristicValue {
    return booleanStateValue(this.device.controlState, 'osc') || booleanStateValue(this.device.controlState, 'oscstate')
      ? this.platform.Characteristic.SwingMode.SWING_ENABLED
      : this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  async setSwingMode(value: CharacteristicValue) {
    if (!this.supportsOscillation) {
      this.platform.log.warn(`[${this.device.name}] Ignoring oscillation change because this device did not report osc support.`);
      return;
    }

    const enabled = value === this.platform.Characteristic.SwingMode.SWING_ENABLED;
    const rawValue = booleanWriteValue(this.device.controlState, 'osc', enabled);
    this.platform.log.info(`[${this.device.name}] Setting oscillation: homekit=${value}, key=osc, raw=${rawValue}`);
    await this.device.setState('osc', rawValue);
  }

  getFilterChangeIndication(): CharacteristicValue {
    return this.device.controlState.filterusage !== undefined && this.device.controlState.filterusage >= this.configDev.filterChangeLevel
      ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
      : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
  }

  getFilterLifeLevel(): CharacteristicValue {
    return 100 - (this.device.controlState.filterusage || 0);
  }

  getCurrentTemperature(): CharacteristicValue {
    return temperatureToCelsius(this.device.sensorState.temperature, this.configDev.temperatureInputUnit);
  }

  getCurrentRelativeHumidity(): CharacteristicValue {
    return this.device.sensorState.humidity || 0;
  }

  getLedOn(): CharacteristicValue {
    return (
      this.device.controlState.brightness !== undefined &&
      this.device.controlState.brightness > 0 &&
      this.device.controlState.nightmode !== true
    );
  }

  async setLedOn(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting LED on to ${value}`);
    await this.device.setLedOn(value as boolean);
  }

  getLedBrightness(): CharacteristicValue {
    return rawToPercent(this.device.controlState.brightness, this.getBrightnessMax());
  }

  async setLedBrightness(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting LED brightness to ${value}`);
    await this.device.setState('brightness', percentToRaw(Number(value), this.getBrightnessMax()));
  }

  getDisplayLightOn(): CharacteristicValue {
    return typeof this.device.controlState.nmbrightness === 'number' && this.device.controlState.nmbrightness > 0;
  }

  async setDisplayLightOn(value: CharacteristicValue) {
    if (!this.supportsDisplayLight) {
      this.platform.log.warn(
        `[${this.device.name}] Ignoring display light change because this device did not report nmbrightness support.`,
      );
      return;
    }

    if (!value) {
      this.lastDisplayBrightness = numericStateValue(this.device.controlState, 'nmbrightness') || this.lastDisplayBrightness;
      this.platform.log.info(`[${this.device.name}] Setting display light: homekit=${value}, key=nmbrightness, raw=0`);
      await this.device.setState('nmbrightness', 0);
      return;
    }

    const rawValue = this.lastDisplayBrightness > 0 ? this.lastDisplayBrightness : this.getDisplayBrightnessMax();
    this.platform.log.info(`[${this.device.name}] Setting display light: homekit=${value}, key=nmbrightness, raw=${rawValue}`);
    await this.device.setState('nmbrightness', rawValue);
  }

  getDisplayBrightness(): CharacteristicValue {
    return rawToPercent(numericStateValue(this.device.controlState, 'nmbrightness'), this.getDisplayBrightnessMax());
  }

  async setDisplayBrightness(value: CharacteristicValue) {
    if (!this.supportsDisplayLight) {
      this.platform.log.warn(
        `[${this.device.name}] Ignoring display brightness change because this device did not report nmbrightness support.`,
      );
      return;
    }

    const rawValue = percentToRaw(Number(value), this.getDisplayBrightnessMax());
    this.platform.log.info(`[${this.device.name}] Setting display brightness: homekit=${value}, key=nmbrightness, raw=${rawValue}`);
    if (rawValue > 0) {
      this.lastDisplayBrightness = rawValue;
    }
    await this.device.setState('nmbrightness', rawValue);
  }

  getPM2_5Density(): CharacteristicValue {
    return this.device.sensorState.pm2_5 || 0;
  }

  getPM10Density(): CharacteristicValue {
    return this.device.sensorState.pm10 || 0;
  }

  getVOCDensity(): CharacteristicValue {
    return this.device.sensorState.voc || 0;
  }

  getAirQuality(): CharacteristicValue {
    if (this.device.sensorState.aqi === undefined) {
      return this.platform.Characteristic.AirQuality.UNKNOWN;
    }

    if (this.device.sensorState.aqi <= 50) {
      return this.platform.Characteristic.AirQuality.EXCELLENT;
    } else if (this.device.sensorState.aqi <= 100) {
      return this.platform.Characteristic.AirQuality.GOOD;
    } else if (this.device.sensorState.aqi <= 150) {
      return this.platform.Characteristic.AirQuality.FAIR;
    } else if (this.device.sensorState.aqi <= 200) {
      return this.platform.Characteristic.AirQuality.INFERIOR;
    } else {
      return this.platform.Characteristic.AirQuality.POOR;
    }
  }

  getGermShield(): CharacteristicValue {
    return this.device.controlState.germshield === true;
  }

  async setGermShield(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting germ shield to ${value}`);
    await this.device.setState('germshield', value as boolean);
  }

  getNightMode(): CharacteristicValue {
    return this.device.controlState.nightmode === true;
  }

  async setNightMode(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting night mode to ${value}`);
    await this.device.setState('nightmode', value as boolean);
  }

  getSleepTimerActive(): CharacteristicValue {
    return booleanStateValue(this.device.controlState, 'timstate')
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  getSleepTimerInUse(): CharacteristicValue {
    return booleanStateValue(this.device.controlState, 'timstate')
      ? this.platform.Characteristic.InUse.IN_USE
      : this.platform.Characteristic.InUse.NOT_IN_USE;
  }

  async setSleepTimerActive(value: CharacteristicValue) {
    if (!this.supportsSleepTimer) {
      this.platform.log.warn(`[${this.device.name}] Ignoring sleep timer change because this device did not report timer support.`);
      return;
    }

    const enabled = value === this.platform.Characteristic.Active.ACTIVE;
    if (enabled) {
      const duration = timerDurationSeconds(this.device.controlState);
      this.platform.log.info(`[${this.device.name}] Setting sleep timer duration: homekit=${duration}, key=timdur, raw=${duration}`);
      await this.device.setState('timdur', duration);
    }

    const rawValue = booleanWriteValue(this.device.controlState, 'timstate', enabled);
    this.platform.log.info(`[${this.device.name}] Setting sleep timer: homekit=${value}, key=timstate, raw=${rawValue}`);
    await this.device.setState('timstate', rawValue);
  }

  getSleepTimerDuration(): CharacteristicValue {
    return timerDurationSeconds(this.device.controlState);
  }

  async setSleepTimerDuration(value: CharacteristicValue) {
    if (!this.supportsSleepTimer) {
      this.platform.log.warn(`[${this.device.name}] Ignoring sleep timer duration because this device did not report timer support.`);
      return;
    }

    const rawValue = nearestTimerPresetSeconds(Number(value));
    this.platform.log.info(`[${this.device.name}] Setting sleep timer duration: homekit=${value}, key=timdur, raw=${rawValue}`);
    await this.device.setState('timdur', rawValue);
  }

  getSleepTimerRemaining(): CharacteristicValue {
    return timerRemainingSeconds(this.device.controlState);
  }

  getClimateActive(): CharacteristicValue {
    return this.getActive();
  }

  async setClimateActive(value: CharacteristicValue) {
    await this.setActive(value);
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (this.device.controlState.standby !== false) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }

    switch (numericStateValue(this.device.controlState, 'mainmode')) {
      case COMFORT_PURE_MAIN_MODE.HEAT:
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
      case COMFORT_PURE_MAIN_MODE.COOL:
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      default:
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    switch (numericStateValue(this.device.controlState, 'mainmode')) {
      case COMFORT_PURE_MAIN_MODE.HEAT:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      case COMFORT_PURE_MAIN_MODE.COOL:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      default:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    const target =
      value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT
        ? COMFORT_PURE_MAIN_MODE.HEAT
        : value === this.platform.Characteristic.TargetHeaterCoolerState.COOL
          ? COMFORT_PURE_MAIN_MODE.COOL
          : COMFORT_PURE_MAIN_MODE.FAN_ONLY;

    this.platform.log.info(`[${this.device.name}] Setting climate mode: homekit=${value}, key=mainmode, raw=${target}`);
    await this.device.setState('mainmode', target);
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    return blueairTemperatureToCelsius(numericStateValue(this.device.controlState, 'heattemp')) ?? 21;
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    const celsius = clampClimateSetpoint(Number(value));
    const rawValue = celsiusToBlueairSetpoint(celsius);
    this.platform.log.info(`[${this.device.name}] Setting heat setpoint: homekit=${value}, key=heattemp, raw=${rawValue}`);
    await this.device.setState('heattemp', rawValue);
  }

  getClimateRotationSpeed(): CharacteristicValue {
    const rawValue = numericStateValue(this.device.controlState, this.getClimateFanSpeedAttribute());
    return fanRawToPercent(rawValue, this.getFanSpeedSpec());
  }

  async setClimateRotationSpeed(value: CharacteristicValue) {
    const attribute = this.getClimateFanSpeedAttribute();
    const rawValue = fanPercentToRaw(Number(value), this.getFanSpeedSpec());
    this.platform.log.info(`[${this.device.name}] Setting climate fan speed: homekit=${value}, key=${attribute}, raw=${rawValue}`);
    await this.device.setState(attribute, rawValue);
  }

  private getFanSpeedSpec(): FanSpeedWriteSpec {
    const attribute = this.getFanSpeedAttribute();
    if (this.configDev.fanSpeedMax && this.configDev.fanSpeedMax > 0) {
      return {
        attribute,
        rawMax: this.configDev.fanSpeedMax,
      };
    }

    return (
      this.device.deviceMetadata.fanSpeed ?? {
        attribute,
        rawMax: this.device.getObservedFanSpeedMax(),
      }
    );
  }

  private getFanSpeedValue(): number | undefined {
    const fanspeed = this.device.controlState.fanspeed;
    if (typeof fanspeed === 'number') {
      return fanspeed;
    }

    const fsp0 = this.device.controlState.fsp0;
    return typeof fsp0 === 'number' ? fsp0 : undefined;
  }

  private getFanSpeedAttribute(): 'fanspeed' | 'fsp0' {
    return this.device.deviceMetadata.fanSpeed?.attribute ?? (this.device.controlState.fanspeed !== undefined ? 'fanspeed' : 'fsp0');
  }

  private getBrightnessMax(): number {
    return brightnessMaxForDevice(this.configDev, this.device.getObservedBrightnessMax());
  }

  private getDisplayBrightnessMax(): number {
    if (this.configDev.displayBrightnessMax && this.configDev.displayBrightnessMax > 0) {
      return this.configDev.displayBrightnessMax;
    }

    return this.device.deviceMetadata.displayBrightness?.rawMax ?? 100;
  }

  private getClimateFanSpeedAttribute(): string {
    switch (numericStateValue(this.device.controlState, 'mainmode')) {
      case COMFORT_PURE_MAIN_MODE.HEAT:
        return this.device.deviceMetadata.climate?.heatFanAttribute ?? 'heatfs';
      case COMFORT_PURE_MAIN_MODE.COOL:
        return this.device.deviceMetadata.climate?.coolFanAttribute ?? 'coolfs';
      default:
        return this.device.deviceMetadata.climate?.fanFanAttribute ?? 'fsp0';
    }
  }

  private shouldExposeComfortPureClimate(): boolean {
    return (
      this.configDev.comfortPureClimateMode === 'gated' &&
      !(this.configDev.disabledServices ?? []).includes('comfortPureClimate') &&
      Boolean(this.device.deviceMetadata.climate) &&
      this.device.sensorState.temperature !== undefined
    );
  }

  private ensureAirQualityService(): void {
    if (this.airQualityService) {
      return;
    }

    const capabilities = inferDeviceCapabilities(this.device.controlState, this.device.sensorState);
    if (
      !shouldExposeDetectedService(
        'airQuality',
        this.configDev.airQualitySensor,
        capabilities.sensors.airQuality,
        this.platform.platformConfig.autoExposeAvailableServices,
        this.configDev.disabledServices ?? [],
      )
    ) {
      return;
    }

    this.airQualityService = this.accessory.addService(
      this.platform.Service.AirQualitySensor,
      serviceName(this.configDev.name || this.device.name, 'Air Quality'),
      'AirQuality',
    );
    this.airQualityService.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
    this.airQualityService.getCharacteristic(this.platform.Characteristic.PM2_5Density).onGet(this.getPM2_5Density.bind(this));
    this.airQualityService.getCharacteristic(this.platform.Characteristic.PM10Density).onGet(this.getPM10Density.bind(this));
    this.airQualityService.getCharacteristic(this.platform.Characteristic.VOCDensity).onGet(this.getVOCDensity.bind(this));
  }

  private ensureTemperatureService(): void {
    if (this.temperatureService) {
      return;
    }

    const capabilities = inferDeviceCapabilities(this.device.controlState, this.device.sensorState);
    if (
      !shouldExposeDetectedService(
        'temperature',
        this.configDev.temperatureSensor,
        capabilities.sensors.temperature,
        this.platform.platformConfig.autoExposeAvailableServices,
        this.configDev.disabledServices ?? [],
      )
    ) {
      return;
    }

    this.temperatureService = this.accessory.addService(
      this.platform.Service.TemperatureSensor,
      serviceName(this.configDev.name || this.device.name, 'Temperature'),
      'Temperature',
    );
    this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));
  }

  private ensureHumidityService(): void {
    if (this.humidityService) {
      return;
    }

    const capabilities = inferDeviceCapabilities(this.device.controlState, this.device.sensorState);
    if (
      !shouldExposeDetectedService(
        'humidity',
        this.configDev.humiditySensor,
        capabilities.sensors.humidity,
        this.platform.platformConfig.autoExposeAvailableServices,
        this.configDev.disabledServices ?? [],
      )
    ) {
      return;
    }

    this.humidityService = this.accessory.addService(
      this.platform.Service.HumiditySensor,
      serviceName(this.configDev.name || this.device.name, 'Humidity'),
      'Humidity',
    );
    this.humidityService
      .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));
  }

  private ensureClimateService(): void {
    if (this.climateService || !this.shouldExposeComfortPureClimate()) {
      return;
    }

    this.climateService = this.accessory.addService(
      this.platform.Service.HeaterCooler,
      serviceName(this.configDev.name || this.device.name, 'Climate'),
      'ComfortPureClimate',
    );

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

    if (this.supportsOscillation && !(this.configDev.disabledServices ?? []).includes('oscillation')) {
      this.climateService
        .getCharacteristic(this.platform.Characteristic.SwingMode)
        .onGet(this.getSwingMode.bind(this))
        .onSet(this.setSwingMode.bind(this));
    }
  }

  private updateClimateCharacteristics(): void {
    if (!this.climateService) {
      return;
    }

    this.climateService.updateCharacteristic(this.platform.Characteristic.Active, this.getClimateActive());
    this.climateService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
    this.climateService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
    this.climateService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
    this.climateService.updateCharacteristic(
      this.platform.Characteristic.HeatingThresholdTemperature,
      this.getHeatingThresholdTemperature(),
    );
    this.climateService.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getClimateRotationSpeed());
    if (this.supportsOscillation) {
      this.climateService.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
    }
  }

  private removeCharacteristicIfPresent(
    service: Service,
    characteristic:
      | typeof this.platform.Characteristic.RotationSpeed
      | typeof this.platform.Characteristic.LockPhysicalControls
      | typeof this.platform.Characteristic.SwingMode
      | typeof this.platform.Characteristic.ConfiguredName,
  ) {
    const existing = service.characteristics.find((serviceCharacteristic) => serviceCharacteristic.UUID === characteristic.UUID);
    if (existing) {
      service.removeCharacteristic(existing);
    }
  }
}
