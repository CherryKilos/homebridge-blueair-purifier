"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceName = exports.sanitizeHomeKitName = void 0;
function sanitizeHomeKitName(name) {
    const sanitized = name
        .replace(/\+/g, ' Plus ')
        .replace(/[^A-Za-z0-9 ']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return sanitized.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '') || 'BlueAir';
}
exports.sanitizeHomeKitName = sanitizeHomeKitName;
function serviceName(baseName, suffix) {
    return sanitizeHomeKitName([baseName, suffix].filter(Boolean).join(' '));
}
exports.serviceName = serviceName;
//# sourceMappingURL=homekitNames.js.map