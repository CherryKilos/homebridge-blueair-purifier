import { Logger } from 'homebridge';
import { Region } from '../platformUtils';
export default class GigyaApi {
    private readonly username;
    private readonly password;
    private readonly logger;
    private api_key;
    private gigyaApiUrl;
    constructor(username: string, password: string, region: Region, logger: Logger);
    getGigyaSession(): Promise<{
        token: string;
        secret: string;
    }>;
    getGigyaJWT(token: string, secret: string): Promise<{
        jwt: string;
    }>;
    private apiCall;
}
//# sourceMappingURL=GigyaApi.d.ts.map