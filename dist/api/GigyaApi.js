"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Consts_1 = require("./Consts");
class GigyaApi {
    constructor(username, password, region, logger) {
        this.username = username;
        this.password = password;
        this.logger = logger;
        const config = (0, Consts_1.getGigyaConfig)(region);
        this.logger.debug(`Creating Gigya API instance with config: ${JSON.stringify(config)} and username: ${username} and region: ${region}`);
        this.api_key = config.apiKey;
        this.gigyaApiUrl = `https://accounts.${config.gigyaRegion}.gigya.com`;
    }
    async getGigyaSession() {
        const params = new URLSearchParams({
            apiKey: this.api_key,
            loginID: this.username,
            password: this.password,
            targetEnv: 'mobile',
        });
        const response = await this.apiCall('/accounts.login', params.toString());
        if (!response.sessionInfo) {
            throw new Error(`Gigya session error: sessionInfo in response: ${JSON.stringify(response)}`);
        }
        this.logger.debug('Gigya session received');
        return {
            token: response.sessionInfo.sessionToken,
            secret: response.sessionInfo.sessionSecret,
        };
    }
    async getGigyaJWT(token, secret) {
        const params = new URLSearchParams({
            oauth_token: token,
            secret: secret,
            targetEnv: 'mobile',
        });
        const response = await this.apiCall('/accounts.getJWT', params.toString());
        if (!response.id_token) {
            throw new Error(`Gigya JWT error: no id_token in response: ${JSON.stringify(response)}`);
        }
        this.logger.debug('Gigya JWT received');
        return {
            jwt: response.id_token,
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async apiCall(url, data, retries = 3) {
        const controller = new AbortController();
        try {
            const response = await fetch(`${this.gigyaApiUrl}${url}?${data}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: '*/*',
                    Connection: 'keep-alive',
                    'Accept-Encoding': 'gzip, deflate, br',
                },
                signal: controller.signal,
            });
            const json = await response.json();
            if (response.status !== 200) {
                throw new Error(`API call error with status ${response.status}: ${response.statusText}, ${JSON.stringify(json)}`);
            }
            return json;
        }
        catch (error) {
            this.logger.error(`API call failed: ${error}`);
            if (retries > 0) {
                this.logger.debug(`Retrying API call (${retries} retries left)...`);
                return this.apiCall(url, data, retries - 1);
            }
            else {
                throw new Error(`API call failed after ${retries} retries`);
            }
        }
    }
}
exports.default = GigyaApi;
//# sourceMappingURL=GigyaApi.js.map