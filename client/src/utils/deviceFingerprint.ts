import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cached: string | null = null;

export async function getDeviceFingerprint(): Promise<string> {
  if (cached) return cached;
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  cached = result.visitorId;
  return cached;
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Safari') ? 'Safari'
    : ua.includes('Edge') ? 'Edge'
    : 'Browser';
  const os = ua.includes('Mac') ? 'macOS'
    : ua.includes('Windows') ? 'Windows'
    : ua.includes('Linux') ? 'Linux'
    : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
    : ua.includes('Android') ? 'Android'
    : 'Unknown OS';
  return `${browser} on ${os}`;
}
