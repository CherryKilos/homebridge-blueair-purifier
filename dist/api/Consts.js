"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLUEAIR_API_TIMEOUT = exports.LOGIN_EXPIRATION = exports.getGigyaConfig = exports.getAwsConfig = void 0;
const platformUtils_1 = require("../platformUtils");
const AWS_CONFIG = {
    [platformUtils_1.Region.US]: {
        restApiId: 'on1keymlmh',
        awsRegion: 'us-east-2',
    },
    [platformUtils_1.Region.EU]: {
        restApiId: 'hkgmr8v960',
        awsRegion: 'eu-west-1',
    },
    [platformUtils_1.Region.CN]: {
        restApiId: 'ftbkyp79si',
        awsRegion: 'cn-north-1',
    },
};
const GIGYA_CONFIG = {
    [platformUtils_1.Region.US]: {
        gigyaRegion: 'us1',
        apiKey: '3_-xUbbrIY8QCbHDWQs1tLXE-CZBQ50SGElcOY5hF1euE11wCoIlNbjMGAFQ6UwhMY',
    },
    [platformUtils_1.Region.EU]: {
        gigyaRegion: 'eu1',
        apiKey: '3_qRseYzrUJl1VyxvSJANalu_kNgQ83swB1B9uzgms58--5w1ClVNmrFdsDnWVQQCl',
    },
    [platformUtils_1.Region.CN]: {
        gigyaRegion: 'cn1',
        apiKey: '3_h3UEfJnA-zDpFPR9L4412HO7Mz2VVeN4wprbWYafPN1gX0kSnLcZ9VSfFi7bEIIU',
    },
    [platformUtils_1.Region.AU]: {
        gigyaRegion: 'au1',
        apiKey: '3_Z2N0mIFC6j2fx1z2sq76R3pwkCMaMX2y9btPb0_PgI_3wfjSJoofFnBbxbtuQksN',
    },
    [platformUtils_1.Region.RU]: {
        gigyaRegion: 'ru1',
        apiKey: '3_wYhHEBaOcS_w6idVM3mh8UjyjOP-3Dwn3w9Z6AYc0FhGf-uIwUkrcoCdsYarND2k',
    },
};
function getAwsConfig(region) {
    var _a;
    return (_a = AWS_CONFIG[region]) !== null && _a !== void 0 ? _a : AWS_CONFIG[platformUtils_1.Region.EU];
}
exports.getAwsConfig = getAwsConfig;
function getGigyaConfig(region) {
    return GIGYA_CONFIG[region];
}
exports.getGigyaConfig = getGigyaConfig;
exports.LOGIN_EXPIRATION = 3600 * 1000 * 24; // n hours in milliseconds
exports.BLUEAIR_API_TIMEOUT = 5 * 1000; // n seconds in milliseconds
//# sourceMappingURL=Consts.js.map