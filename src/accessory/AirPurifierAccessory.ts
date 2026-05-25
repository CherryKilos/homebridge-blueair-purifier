import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BlueAirPlatform } from '../platform';
import { BlueAirDevice } from '../device/BlueAirDevice';
import { DeviceConfig } from '../platformUtils';
import { FullBlueAirDeviceState } from '../api/BlueAirAwsApi';
import {
  brightnessMaxForDevice,
  fanSpeedMaxForDevice,
  inferDeviceCapabilities,
  percentToRaw,
  rawToPercent,
  shouldExposeDetectedService,
  shouldExposeService,
  temperatureToCelsius,
} from '../device/capabilities';

export class AirPurifierAccessory {
  private service: Service;
  private filterMaintenanceService?: Service;
  private ledService?: Service;
  private airQualityService?: Service;
  private temperatureService?: Service;
  private humidityService?: Service;
  private germShieldService?: Service;
  private nightModeService?: Service;
  private supportsAutoMode = false;
  private supportsChildLock = false;
  private supportsFanSpeed = false;

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

    const capabilities = inferDeviceCapabilities(this.device.state, this.device.sensorData);
    const autoExposeAvailableServices = this.platform.platformConfig.autoExposeAvailableServices;
    const disabledServices = this.configDev.disabledServices ?? [];
    this.supportsAutoMode = capabilities.controls.autoMode;
    this.supportsChildLock = capabilities.controls.childLock;
    this.supportsFanSpeed = capabilities.controls.fanSpeed;

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

    this.filterMaintenanceService =
      this.accessory.getService(this.platform.Service.FilterMaintenance) ||
      this.accessory.addService(this.platform.Service.FilterMaintenance);

    this.filterMaintenanceService
      .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
      .onGet(this.getFilterChangeIndication.bind(this));

    this.filterMaintenanceService.getCharacteristic(this.platform.Characteristic.FilterLifeLevel).onGet(this.getFilterLifeLevel.bind(this));

    this.ledService = this.accessory.getServiceById(this.platform.Service.Lightbulb, 'Led');
    if (shouldExposeService('led', this.configDev.led, capabilities.controls.brightness, autoExposeAvailableServices, disabledServices)) {
      this.ledService ??= this.accessory.addService(this.platform.Service.Lightbulb, `${this.device.name} Led`, 'Led');
      this.ledService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Led`);
      this.ledService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Led`);
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
        `${this.device.name} Air Quality`,
        'AirQuality',
      );
      this.airQualityService.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
      this.airQualityService.getCharacteristic(this.platform.Characteristic.PM2_5Density).onGet(this.getPM2_5Density.bind(this));
      this.airQualityService.getCharacteristic(this.platform.Characteristic.PM10Density).onGet(this.getPM10Density.bind(this));
      this.airQualityService.getCharacteristic(this.platform.Characteristic.VOCDensity).onGet(this.getVOCDensity.bind(this));
    } else if (this.airQualityService) {
      this.accessory.removeService(this.airQualityService);
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
        `${this.device.name} Temperature`,
        'Temperature',
      );
      this.temperatureService
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this));
    } else if (this.temperatureService) {
      this.accessory.removeService(this.temperatureService);
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
      this.humidityService ??= this.accessory.addService(this.platform.Service.HumiditySensor, `${this.device.name} Humidity`, 'Humidity');
      this.humidityService
        .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(this.getCurrentRelativeHumidity.bind(this));
    } else if (this.humidityService) {
      this.accessory.removeService(this.humidityService);
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
      this.germShieldService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Germ Shield`, 'GermShield');
      this.germShieldService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Germ Shield`);
      this.germShieldService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Germ Shield`);
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
      this.nightModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Night Mode`, 'NightMode');
      this.nightModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Night Mode`);
      this.nightModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Night Mode`);
      this.nightModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getNightMode.bind(this))
        .onSet(this.setNightMode.bind(this));
    } else if (this.nightModeService) {
      this.accessory.removeService(this.nightModeService);
    }

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
          if (this.supportsFanSpeed) {
            this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
            this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.getCurrentAirPurifierState());
          }
          break;
        case 'filterusage':
          this.filterMaintenanceService?.updateCharacteristic(
            this.platform.Characteristic.FilterChangeIndication,
            this.getFilterChangeIndication(),
          );
          this.filterMaintenanceService?.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, this.getFilterLifeLevel());
          break;
        case 'temperature':
          this.temperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
          break;
        case 'humidity':
          this.humidityService?.updateCharacteristic(
            this.platform.Characteristic.CurrentRelativeHumidity,
            this.getCurrentRelativeHumidity(),
          );
          break;
        case 'brightness':
          this.ledService?.updateCharacteristic(this.platform.Characteristic.On, this.getLedOn());
          this.ledService?.updateCharacteristic(this.platform.Characteristic.Brightness, this.getLedBrightness());
          break;
        case 'pm2_5':
          this.airQualityService?.updateCharacteristic(this.platform.Characteristic.PM2_5Density, this.getPM2_5Density());
          updateAirQuality = true;
          break;
        case 'pm10':
          this.airQualityService?.updateCharacteristic(this.platform.Characteristic.PM10Density, this.getPM10Density());
          updateAirQuality = true;
          break;
        case 'voc':
          this.airQualityService?.updateCharacteristic(this.platform.Characteristic.VOCDensity, this.getVOCDensity());
          updateAirQuality = true;
          break;
        case 'germshield':
          this.germShieldService?.updateCharacteristic(this.platform.Characteristic.On, this.getGermShield());
          break;
        case 'nightmode':
          this.nightModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getNightMode());
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
      }

      if (updateAirQuality) {
        this.airQualityService?.updateCharacteristic(this.platform.Characteristic.AirQuality, this.getAirQuality());
      }
    }
  }

  getActive(): CharacteristicValue {
    return this.device.state.standby === false ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting active to ${value}`);
    await this.device.setState('standby', value === this.platform.Characteristic.Active.INACTIVE);
  }

  getCurrentAirPurifierState(): CharacteristicValue {
    if (this.device.state.standby === false) {
      return this.device.state.automode && this.device.state.fanspeed === 0
        ? this.platform.Characteristic.CurrentAirPurifierState.IDLE
        : this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    }

    return this.platform.Characteristic.CurrentAirPurifierState.INACTIVE;
  }

  getTargetAirPurifierState(): CharacteristicValue {
    return this.device.state.automode
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
    return this.device.state.childlock
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
    return this.device.state.standby === false ? rawToPercent(this.device.state.fanspeed, this.getFanSpeedMax()) : 0;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting rotation speed to ${value}`);
    if (!this.supportsFanSpeed) {
      this.platform.log.warn(`[${this.device.name}] Ignoring fan speed change because this device did not report fanspeed support.`);
      return;
    }
    await this.device.setState('fanspeed', percentToRaw(Number(value), this.getFanSpeedMax()));
  }

  getFilterChangeIndication(): CharacteristicValue {
    return this.device.state.filterusage !== undefined && this.device.state.filterusage >= this.configDev.filterChangeLevel
      ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
      : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
  }

  getFilterLifeLevel(): CharacteristicValue {
    return 100 - (this.device.state.filterusage || 0);
  }

  getCurrentTemperature(): CharacteristicValue {
    return temperatureToCelsius(this.device.sensorData.temperature, this.configDev.temperatureInputUnit);
  }

  getCurrentRelativeHumidity(): CharacteristicValue {
    return this.device.sensorData.humidity || 0;
  }

  getLedOn(): CharacteristicValue {
    return this.device.state.brightness !== undefined && this.device.state.brightness > 0 && this.device.state.nightmode !== true;
  }

  async setLedOn(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting LED on to ${value}`);
    await this.device.setLedOn(value as boolean);
  }

  getLedBrightness(): CharacteristicValue {
    return rawToPercent(this.device.state.brightness, this.getBrightnessMax());
  }

  async setLedBrightness(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting LED brightness to ${value}`);
    await this.device.setState('brightness', percentToRaw(Number(value), this.getBrightnessMax()));
  }

  getPM2_5Density(): CharacteristicValue {
    return this.device.sensorData.pm2_5 || 0;
  }

  getPM10Density(): CharacteristicValue {
    return this.device.sensorData.pm10 || 0;
  }

  getVOCDensity(): CharacteristicValue {
    return this.device.sensorData.voc || 0;
  }

  getAirQuality(): CharacteristicValue {
    if (this.device.sensorData.aqi === undefined) {
      return this.platform.Characteristic.AirQuality.UNKNOWN;
    }

    if (this.device.sensorData.aqi <= 50) {
      return this.platform.Characteristic.AirQuality.EXCELLENT;
    } else if (this.device.sensorData.aqi <= 100) {
      return this.platform.Characteristic.AirQuality.GOOD;
    } else if (this.device.sensorData.aqi <= 150) {
      return this.platform.Characteristic.AirQuality.FAIR;
    } else if (this.device.sensorData.aqi <= 200) {
      return this.platform.Characteristic.AirQuality.INFERIOR;
    } else {
      return this.platform.Characteristic.AirQuality.POOR;
    }
  }

  getGermShield(): CharacteristicValue {
    return this.device.state.germshield === true;
  }

  async setGermShield(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting germ shield to ${value}`);
    await this.device.setState('germshield', value as boolean);
  }

  getNightMode(): CharacteristicValue {
    return this.device.state.nightmode === true;
  }

  async setNightMode(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] Setting night mode to ${value}`);
    await this.device.setState('nightmode', value as boolean);
  }

  private getFanSpeedMax(): number {
    return fanSpeedMaxForDevice(this.configDev, this.device.getObservedFanSpeedMax());
  }

  private getBrightnessMax(): number {
    return brightnessMaxForDevice(this.configDev, this.device.getObservedBrightnessMax());
  }

  private removeCharacteristicIfPresent(
    service: Service,
    characteristic: typeof this.platform.Characteristic.RotationSpeed | typeof this.platform.Characteristic.LockPhysicalControls,
  ) {
    if (service.testCharacteristic(characteristic)) {
      service.removeCharacteristic(service.getCharacteristic(characteristic));
    }
  }
}
