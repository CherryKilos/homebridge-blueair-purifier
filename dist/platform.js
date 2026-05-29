"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueAirPlatform = void 0;
const settings_1 = require("./settings");
const platformUtils_1 = require("./platformUtils");
const lodash_1 = require("lodash");
const BlueAirAwsApi_1 = __importDefault(require("./api/BlueAirAwsApi"));
const BlueAirDevice_1 = require("./device/BlueAirDevice");
const AirPurifierAccessory_1 = require("./accessory/AirPurifierAccessory");
const events_1 = __importDefault(require("events"));
const BlueAirRealtimeApi_1 = __importDefault(require("./api/BlueAirRealtimeApi"));
const comfortPureControls_1 = require("./device/comfortPureControls");
class BlueAirPlatform extends events_1.default {
    constructor(log, config, api) {
        super();
        this.log = log;
        this.config = config;
        this.api = api;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.existingUuids = [];
        this.devices = [];
        this.polling = null;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        this.platformConfig = (0, lodash_1.defaultsDeep)(config, platformUtils_1.defaultConfig);
        this.platformConfig.devices = this.platformConfig.devices.map((device) => (0, lodash_1.defaultsDeep)(device, platformUtils_1.defaultDeviceConfig));
        this.log.debug('Finished initializing platform:', this.platformConfig.name);
        if (!this.platformConfig.username || !this.platformConfig.password || !this.platformConfig.accountUuid) {
            this.log.error('Missing required configuration options! Please do the device discovery in the configuration UI and/or check your\
      config.json file');
        }
        this.blueAirApi = new BlueAirAwsApi_1.default(this.platformConfig.username, this.platformConfig.password, this.platformConfig.region, log);
        this.api.on('didFinishLaunching', async () => {
            await this.getInitialDeviceStates();
            await this.startRealtimeSensors();
            this.getValidDevicesStatus();
        });
        this.api.on('shutdown', () => {
            var _a;
            if (this.polling) {
                clearTimeout(this.polling);
            }
            (_a = this.realtimeApi) === null || _a === void 0 ? void 0 : _a.stop();
        });
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    async getValidDevicesStatus() {
        this.log.debug('Updating devices states...');
        try {
            const devices = await this.blueAirApi.getDeviceStatus(this.platformConfig.accountUuid, this.existingUuids);
            for (const device of devices) {
                const blueAirDevice = this.devices.find((d) => d.id === device.id);
                if (!blueAirDevice) {
                    this.log.error(`[${device.name}] Device not found in cache!`);
                    continue;
                }
                this.log.debug(`[${device.name}] Updating device state...`);
                blueAirDevice.emit('update', device);
            }
            this.log.debug('Devices states updated!');
        }
        catch (error) {
            const err = error;
            this.log.warn('Error getting valid devices status, reason:' + err.message + '. Retrying in 5 seconds...');
            this.log.debug('Error stack:', err.stack);
        }
        finally {
            this.polling = setTimeout(this.getValidDevicesStatus.bind(this), this.platformConfig.pollingInterval);
        }
    }
    async getInitialDeviceStates() {
        this.log.info('Getting initial device states...');
        try {
            await this.blueAirApi.login();
            let uuids = this.platformConfig.devices.map((device) => device.id);
            const devices = await this.blueAirApi.getDeviceStatus(this.platformConfig.accountUuid, uuids);
            for (const device of devices) {
                this.addDevice(device);
                uuids = uuids.filter((uuid) => uuid !== device.id);
            }
            for (const uuid of uuids) {
                const device = this.platformConfig.devices.find((device) => device.id === uuid);
                this.log.warn(`[${device.name}] Device not found in AWS API response!`);
            }
            this.log.info('All configured devices have been added!');
        }
        catch (error) {
            this.log.error('Error getting initial device states:', error);
        }
    }
    async startRealtimeSensors() {
        if (this.platformConfig.realtimeSensors === 'off' || this.realtimeApi || this.devices.length === 0) {
            return;
        }
        try {
            if (this.platformConfig.sensorDiagnostics) {
                this.logDeclaredRealtimeSensors();
            }
            const mqttAuth = await this.blueAirApi.getMqttAuth();
            if (!mqttAuth) {
                this.log.warn('Blueair realtime sensor credentials were not returned by the cloud API; continuing with REST polling only.');
                return;
            }
            this.realtimeApi = new BlueAirRealtimeApi_1.default(mqttAuth, this.devices.map((device) => device.id), this.log, (update) => this.handleRealtimeUpdate(update), this.platformConfig.sensorDiagnostics);
            this.realtimeApi.start();
        }
        catch (error) {
            this.log.warn(`Unable to start Blueair realtime sensors: ${error instanceof Error ? error.message : error}`);
        }
    }
    logDeclaredRealtimeSensors() {
        for (const device of this.devices) {
            const declared = device.deviceMetadata.declaredDataSources;
            const realtime = device.deviceMetadata.declaredRealtimeSensors;
            const streams = ['rt1s', 'rt5s', 'rt5m', 'b5m'].filter((stream) => declared.ds.includes(stream));
            const message = `[${device.name}] Declared Blueair realtime sensor slugs: ${realtime.join(',') || 'none from rt*.sn'}; ` +
                `streams=${streams.join(',') || 'none'}; ` +
                `ds=${declared.ds.join(',') || 'none'}; dc=${declared.dc.join(',') || 'none'}; ` +
                `rt5s=${declared.rt5s.join(',') || 'none'}; rt5m=${declared.rt5m.join(',') || 'none'}; b5m=${declared.b5m.join(',') || 'none'}`;
            this.log.info(message);
        }
    }
    handleRealtimeUpdate(update) {
        const blueAirDevice = this.devices.find((device) => device.id === update.deviceId);
        if (!blueAirDevice) {
            return;
        }
        const sensorState = { ...update.sensorData };
        delete sensorState.fanspeed;
        delete sensorState.fsp0;
        if (!this.platformConfig.sensorDiagnostics) {
            delete sensorState.rssi;
        }
        if (Object.keys(sensorState).length === 0) {
            return;
        }
        blueAirDevice.emit('update', {
            id: blueAirDevice.id,
            name: blueAirDevice.name,
            controlState: {},
            sensorState,
            deviceMetadata: blueAirDevice.deviceMetadata,
            source: 'realtime',
            state: {},
            sensorData: sensorState,
        });
    }
    async addDevice(device) {
        const uuid = this.api.hap.uuid.generate(device.id);
        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
        const deviceConfig = this.platformConfig.devices.find((config) => config.id === device.id);
        this.existingUuids.push(device.id);
        if (!deviceConfig) {
            this.log.error(`[${device.name}] Device configuration not found!`);
            return;
        }
        const blueAirDevice = new BlueAirDevice_1.BlueAirDevice(device);
        this.devices.push(blueAirDevice);
        this.logDeviceStartupSummary(blueAirDevice, deviceConfig);
        blueAirDevice.on('setState', async ({ id, name, attribute, value }) => {
            // this.log.info(`[${name}] Setting state: ${attribute} = ${value}`);
            // Clear polling to avoid conflicts
            this.polling && clearTimeout(this.polling);
            let success = false;
            try {
                await this.blueAirApi.setDeviceStatus(id, attribute, value);
                success = true;
                this.log.info(`[${name}] Write succeeded: key=${attribute}, raw=${value}`);
            }
            catch (error) {
                this.log.error(`[${name}] Write failed: key=${attribute}, raw=${value}`, error);
            }
            finally {
                blueAirDevice.emit('setStateDone', success);
                // Have to clear polling again to avoid conflicts
                this.polling && clearTimeout(this.polling);
                this.polling = setTimeout(this.getValidDevicesStatus.bind(this), this.platformConfig.pollingInterval);
            }
        });
        if (existingAccessory) {
            this.log.info(`[${deviceConfig.name}] Restoring existing accessory from cache: ${existingAccessory.displayName}`);
            new AirPurifierAccessory_1.AirPurifierAccessory(this, existingAccessory, blueAirDevice, deviceConfig);
        }
        else {
            this.log.info('Adding new accessory:', device.name);
            const accessory = new this.api.platformAccessory(device.name, uuid);
            new AirPurifierAccessory_1.AirPurifierAccessory(this, accessory, blueAirDevice, deviceConfig);
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        }
    }
    logDeviceStartupSummary(device, deviceConfig) {
        var _a, _b, _c, _d;
        const metadata = device.deviceMetadata;
        const displayOffFloor = (0, comfortPureControls_1.resolveDisplayBrightnessOffFloor)(deviceConfig.displayBrightnessOffFloor, metadata.adapterId === 'comfort-pure-t10i');
        const climateStatus = deviceConfig.comfortPureClimateMode === 'gated'
            ? device.sensorState.temperature !== undefined
                ? 'gated-visible'
                : 'gated-waiting-for-temperature'
            : 'off';
        this.log.info(`[${device.name}] Blueair adapter=${metadata.adapterId}; fanWrite=${(_b = (_a = metadata.fanSpeed) === null || _a === void 0 ? void 0 : _a.attribute) !== null && _b !== void 0 ? _b : 'none'}; ` +
            `display=${(_d = (_c = metadata.displayBrightness) === null || _c === void 0 ? void 0 : _c.attribute) !== null && _d !== void 0 ? _d : 'none'}; displayOffFloor=${displayOffFloor}; ` +
            `realtime=${this.platformConfig.realtimeSensors}; climate=${climateStatus}`);
    }
}
exports.BlueAirPlatform = BlueAirPlatform;
//# sourceMappingURL=platform.js.map