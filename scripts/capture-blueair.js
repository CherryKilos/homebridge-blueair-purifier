const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { defaultsDeep } = require('lodash');

const BlueAirAwsApi = require('../dist/api/BlueAirAwsApi.js').default;
const { defaultConfig } = require('../dist/platformUtils.js');
const { PLATFORM_NAME } = require('../dist/settings.js');

const SENSITIVE_KEY_PATTERNS = [/authorization/i, /password/i, /secret/i, /session/i, /token/i, /^apiKey$/i, /^idtoken$/i, /^jwt$/i];
const PSEUDONYM_KEY_PATTERNS = [/accountUuid/i, /^id$/i, /^mac$/i, /^uuid$/i];
const replacements = new Map();

const logger = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

function homebridgeConfigPath() {
  return process.env.BLUEAIR_CONFIG || path.join(os.homedir(), '.homebridge', 'config.json');
}

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function shouldPseudonymize(key) {
  return PSEUDONYM_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function pseudonymize(value, key) {
  const replacementKey = `${key}:${value}`;
  const existing = replacements.get(replacementKey);
  if (existing) {
    return existing;
  }

  const replacement = `<redacted-${key}-${replacements.size + 1}>`;
  replacements.set(replacementKey, replacement);
  return replacement;
}

function redact(value, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }

  if (typeof value === 'string') {
    if (isSensitiveKey(key)) {
      return '<redacted>';
    }

    if (shouldPseudonymize(key)) {
      return pseudonymize(value, key);
    }
  }

  return value;
}

async function loadPluginConfig() {
  const configPath = homebridgeConfigPath();
  const rawConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const pluginConfig = rawConfig.platforms?.find((platform) => platform.platform === PLATFORM_NAME);

  if (!pluginConfig) {
    throw new Error(`No "${PLATFORM_NAME}" platform config found in ${configPath}`);
  }

  return defaultsDeep({}, pluginConfig, defaultConfig);
}

async function main() {
  const config = await loadPluginConfig();
  if (!config.username || !config.password) {
    throw new Error('Blueair username/password are required in the Homebridge plugin config before capture can run.');
  }

  const api = new BlueAirAwsApi(config.username, config.password, config.region, logger);
  await api.login();

  const registeredDevices = await api.getDevices();
  const accountUuid = config.accountUuid || registeredDevices[0]?.name;
  const configuredUuids = config.devices.map((device) => device.id).filter(Boolean);
  const uuids = configuredUuids.length ? configuredUuids : registeredDevices.map((device) => device.uuid);

  const rawInitialState = accountUuid && uuids.length ? await api.getRawDeviceStatus(accountUuid, uuids) : undefined;
  const normalizedStatus = accountUuid && uuids.length ? await api.getDeviceStatus(accountUuid, uuids) : [];

  const capture = redact({
    capturedAt: new Date().toISOString(),
    config: {
      region: config.region,
      accountUuid,
      devices: config.devices,
    },
    registeredDevices,
    rawInitialState,
    normalizedStatus,
  });

  const outputDir = path.resolve(process.cwd(), 'fixtures', 'personal');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `blueair-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(capture, null, 2)}\n`);

  console.info(`Wrote redacted Blueair capture to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
