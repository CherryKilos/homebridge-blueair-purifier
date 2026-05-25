export function sanitizeHomeKitName(name: string): string {
  const sanitized = name
    .replace(/\+/g, ' Plus ')
    .replace(/[^A-Za-z0-9 ']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '') || 'BlueAir';
}

export function serviceName(baseName: string, suffix?: string): string {
  return sanitizeHomeKitName([baseName, suffix].filter(Boolean).join(' '));
}
