# Homebridge Blueair Personal Fork

Personal Homebridge fork for:

- ComfortPure 3-in-1 T10i
- Blue Pure 211i Max
- Blue Pure 311i+ Max

This fork keeps Blueair REST writes as the only control path and uses Blueair MQTT realtime data only for read-only sensors.

## Install On Homebridge

Commit and push local changes to GitHub, then run this on the Homebridge server:

```bash
cd /var/lib/homebridge

sudo hb-service stop

sudo -u homebridge env "PATH=/opt/homebridge/bin:$PATH" HOME=/var/lib/homebridge \
  /opt/homebridge/bin/npm cache clean --force

sudo rm -rf /var/lib/homebridge/node_modules/homebridge-blueair-purifier

sudo -u homebridge env "PATH=/opt/homebridge/bin:$PATH" HOME=/var/lib/homebridge \
  /opt/homebridge/bin/npm install --prefix /var/lib/homebridge --omit=dev --force \
  https://codeload.github.com/CherryKilos/homebridge-blueair-purifier/tar.gz/refs/heads/main

sudo test -f /var/lib/homebridge/node_modules/homebridge-blueair-purifier/dist/index.js && echo "Blueair installed"

sudo hb-service restart
```

Check logs:

```bash
sudo hb-service logs | grep -iE "blueair|error|failed"
```

## HomeKit Mapping

- Power: HomeKit `AirPurifier.Active`, Blueair `standby`.
- Fan speed:
  - Blue Pure Max devices write `fanspeed` on a `0-91` raw scale.
  - ComfortPure writes `fsp0` using the T10i steps `11 / 37 / 64 / 91`.
- Oscillation: HomeKit `SwingMode`, Blueair `osc` only.
- Display lock: HomeKit `LockPhysicalControls`, Blueair `childlock`.
- ComfortPure display brightness: separate `Display` Lightbulb, Blueair `nmbrightness`.
- Sensors: temperature, humidity, PM, and VOC are read-only. ComfortPure temperature/humidity come from realtime MQTT when available.
- Climate: optional gated `HeaterCooler`, disabled by default.
- Sleep timer: disabled by default because HomeKit renders it as a valve/faucet.

## Useful Config

```json
{
  "realtimeSensors": "auto",
  "sensorDiagnostics": false,
  "devices": [
    {
      "name": "ComfortPure",
      "comfortPureClimateMode": "off",
      "displayBrightnessMax": 100,
      "displayBrightnessOffFloor": 7,
      "sleepTimer": false,
      "disabledServices": []
    }
  ]
}
```

Leave `displayBrightnessOffFloor` blank for automatic behavior. ComfortPure defaults to `7`; other devices default to `0`.

## Diagnostics

Run a redacted capture from the installed plugin directory:

```bash
cd /var/lib/homebridge/node_modules/homebridge-blueair-purifier

sudo -u homebridge env "PATH=/opt/homebridge/bin:$PATH" HOME=/var/lib/homebridge BLUEAIR_CONFIG=/var/lib/homebridge/config.json \
  /opt/homebridge/bin/npm run capture:blueair
```

Personal captures are written under `fixtures/personal/` and should stay out of git.

Enable `sensorDiagnostics: true` only while troubleshooting. It logs declared realtime sensor slugs and first payload shapes.

## Troubleshooting

- Plugin missing in the Homebridge UI: install into `/var/lib/homebridge/node_modules`, not only the global npm root.
- `sudo npm: command not found`: use `/opt/homebridge/bin/npm` with `PATH=/opt/homebridge/bin:$PATH`.
- Stale HomeKit tiles: restart the Blueair child bridge after reinstall. If a removed service still appears, remove the cached accessory from Homebridge UI only after confirming the plugin is installed correctly.
- ComfortPure display shows `7%` when off: reinstall this fork version; raw `nmbrightness <= 7` is treated as off.
- ComfortPure temperature missing: wait for realtime MQTT data or run `capture:blueair`; this fork does not fake ambient temperature from `heattemp`.

## Local Validation

```bash
npm test
npm run lint
npm run build
npm pack --dry-run
```
