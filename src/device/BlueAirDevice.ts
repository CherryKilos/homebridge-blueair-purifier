import EventEmitter from 'events';
import { BlueAirDeviceSensorData, BlueAirDeviceState, BlueAirDeviceStatus, FullBlueAirDeviceState } from '../api/BlueAirAwsApi';
import { Mutex } from 'async-mutex';

type AQILevels = {
  AQI_LO: number[];
  AQI_HI: number[];
  CONC_LO: number[];
  CONC_HI: number[];
};

// https://forum.airnowtech.org/t/the-aqi-equation-2024-valid-beginning-may-6th-2024
const AQI: { [key: string]: AQILevels } = {
  PM2_5: {
    AQI_LO: [0, 51, 101, 151, 201, 301],
    AQI_HI: [50, 100, 150, 200, 300, 500],
    CONC_LO: [0.0, 9.1, 35.5, 55.5, 125.5, 225.5],
    CONC_HI: [9.0, 35.4, 55.4, 125.4, 225.4, 325.4],
  },
  PM10: {
    AQI_LO: [0, 51, 101, 151, 201, 301],
    AQI_HI: [50, 100, 150, 200, 300, 500],
    CONC_LO: [0, 55, 155, 255, 355, 425],
    CONC_HI: [54, 154, 254, 354, 424, 604],
  },
  VOC: {
    AQI_LO: [0, 51, 101, 151, 201, 301],
    AQI_HI: [50, 100, 150, 200, 300, 500],
    CONC_LO: [0, 221, 661, 1431, 2201, 3301],
    CONC_HI: [220, 660, 1430, 2200, 3300, 5500],
  },
};

type BlueAirSensorDataWithAqi = BlueAirDeviceSensorData & { aqi?: number };

type PendingChanges = {
  state: Partial<BlueAirDeviceState>;
  sensorData: Partial<BlueAirSensorDataWithAqi>;
};

interface BlueAirDeviceEvents {
  stateUpdated: (changedStates: Partial<FullBlueAirDeviceState>) => void;
  update: (newState: BlueAirDeviceStatus) => void;
  setState: (data: { id: string; name: string; attribute: string; value: number | boolean }) => void;
  setStateDone: (success: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface BlueAirDevice {
  on<K extends keyof BlueAirDeviceEvents>(event: K, listener: BlueAirDeviceEvents[K]): this;
  emit<K extends keyof BlueAirDeviceEvents>(event: K, ...args: Parameters<BlueAirDeviceEvents[K]>): boolean;
  once<K extends keyof BlueAirDeviceEvents>(event: K, listener: BlueAirDeviceEvents[K]): this;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class BlueAirDevice extends EventEmitter {
  public controlState: BlueAirDeviceState;
  public sensorState: BlueAirSensorDataWithAqi;
  public deviceMetadata: BlueAirDeviceStatus['deviceMetadata'];

  /**
   * Legacy aliases for accessory code that still reads state/sensorData.
   */
  public state: BlueAirDeviceState;
  public sensorData: BlueAirSensorDataWithAqi;

  public readonly id: string;
  public readonly name: string;

  private mutex: Mutex;

  private currentChanges: PendingChanges;

  private last_brightness: number;
  private observedFanSpeedMax: number;
  private observedBrightnessMax: number;

  constructor(device: BlueAirDeviceStatus) {
    super();
    this.id = device.id;
    this.name = device.name;

    this.controlState = device.controlState;
    this.sensorState = {
      ...device.sensorState,
      aqi: undefined,
    };
    this.sensorState.aqi = this.calculateAqi(this.sensorState);
    this.deviceMetadata = device.deviceMetadata;
    this.state = this.controlState;
    this.sensorData = this.sensorState;

    this.mutex = new Mutex();
    this.currentChanges = {
      state: {},
      sensorData: {},
    };

    this.last_brightness = this.controlState.brightness || 0;
    this.observedFanSpeedMax = 0;
    this.observedBrightnessMax = 0;
    this.updateObservedMaxima(this.controlState);

    this.on('update', this.updateState.bind(this));
  }

  private hasChanges(changes: PendingChanges): boolean {
    return Object.keys(changes.state).length > 0 || Object.keys(changes.sensorData).length > 0;
  }

  private async notifyStateUpdate(newState?: Partial<BlueAirDeviceState>, newSensorData?: Partial<BlueAirDeviceSensorData>) {
    this.currentChanges = {
      state: {
        ...this.currentChanges.state,
        ...newState,
      },
      sensorData: {
        ...this.currentChanges.sensorData,
        ...newSensorData,
      },
    };

    // always acquire the mutex to ensure all changes are eventually applied
    const release = await this.mutex.acquire();

    const changesToApply = this.currentChanges;
    this.currentChanges = { state: {}, sensorData: {} };

    // if there is a change, emit update event
    if (this.hasChanges(changesToApply)) {
      this.controlState = { ...this.controlState, ...changesToApply.state };
      this.sensorState = { ...this.sensorState, ...changesToApply.sensorData };
      this.state = this.controlState;
      this.sensorData = this.sensorState;
      this.updateObservedMaxima(changesToApply.state);
      this.emit('stateUpdated', { ...changesToApply.state, ...changesToApply.sensorData });
    }

    release();
  }

  public async setState(attribute: string, value: number | boolean) {
    if (attribute in this.controlState === false) {
      throw new Error(`Invalid state: ${attribute}`);
    }

    if (this.controlState[attribute] === value) {
      return;
    }

    this.emit('setState', { id: this.id, name: this.name, attribute, value });

    const release = await this.mutex.acquire();

    return new Promise<void>((resolve) => {
      this.once('setStateDone', async (success) => {
        release();
        if (success) {
          const newState: Partial<BlueAirDeviceState> = { [attribute]: value };
          await this.notifyStateUpdate(newState);
        }
        resolve();
      });
    });
  }

  public async setLedOn(value: boolean) {
    if (!value) {
      this.last_brightness = this.controlState.brightness || 0;
    }
    const brightness = value ? this.last_brightness : 0;
    await this.setState('brightness', brightness);
  }

  private async updateState(newState: BlueAirDeviceStatus) {
    const changedState: Partial<BlueAirDeviceState> = {};
    const changedSensorData: Partial<BlueAirSensorDataWithAqi> = {};
    const incomingControlState = newState.controlState ?? newState.state;
    const incomingSensorState = newState.sensorState ?? newState.sensorData;

    this.deviceMetadata = newState.deviceMetadata ?? this.deviceMetadata;

    for (const [k, v] of Object.entries(incomingControlState)) {
      if (this.controlState[k] !== v) {
        changedState[k] = v;
      }
    }
    for (const [k, v] of Object.entries(incomingSensorState)) {
      if (this.sensorState[k] !== v) {
        changedSensorData[k] = v;
      }
    }
    if ('pm2_5' in changedSensorData || 'pm10' in changedSensorData || 'voc' in changedSensorData) {
      changedSensorData.aqi = this.calculateAqi({ ...this.sensorState, ...changedSensorData });
    }
    await this.notifyStateUpdate(changedState, changedSensorData);
  }

  public getObservedFanSpeedMax(): number {
    return this.observedFanSpeedMax;
  }

  public getObservedBrightnessMax(): number {
    return this.observedBrightnessMax;
  }

  private updateObservedMaxima(state: Partial<BlueAirDeviceState>) {
    const rawFsp0 = state.fsp0;
    const fanSpeed = typeof state.fanspeed === 'number' ? state.fanspeed : typeof rawFsp0 === 'number' ? rawFsp0 : undefined;
    if (typeof fanSpeed === 'number' && fanSpeed > this.observedFanSpeedMax) {
      this.observedFanSpeedMax = fanSpeed;
    }

    if (typeof state.brightness === 'number' && state.brightness > this.observedBrightnessMax) {
      this.observedBrightnessMax = state.brightness;
    }
  }

  private calculateAqi(sensorData: BlueAirSensorDataWithAqi = this.sensorState): number | undefined {
    if (sensorData.pm2_5 === undefined && sensorData.pm10 === undefined && sensorData.voc === undefined) {
      return undefined;
    }

    const pm2_5 = Math.round((sensorData.pm2_5 || 0) * 10) / 10;
    const pm10 = sensorData.pm10 || 0;
    const voc = sensorData.voc || 0;

    const aqi_pm2_5 = this.calculateAqiForSensor(pm2_5, 'PM2_5');
    const aqi_pm10 = this.calculateAqiForSensor(pm10, 'PM10');
    const aqi_voc = this.calculateAqiForSensor(voc, 'VOC');

    return Math.max(aqi_pm2_5, aqi_pm10, aqi_voc);
  }

  private calculateAqiForSensor(value: number, sensor: string) {
    const levels = AQI[sensor];
    for (let i = 0; i < levels.AQI_LO.length; i++) {
      if (value >= levels.CONC_LO[i] && value <= levels.CONC_HI[i]) {
        return Math.round(
          ((levels.AQI_HI[i] - levels.AQI_LO[i]) / (levels.CONC_HI[i] - levels.CONC_LO[i])) * (value - levels.CONC_LO[i]) +
            levels.AQI_LO[i],
        );
      }
    }
    return 0;
  }
}
