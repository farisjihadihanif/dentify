/** Device and camera capability checks for the scan camera. */

import type { CameraFacingMode } from '../components/WebcamCapture';

export interface DeviceInfo {
  userAgent: string;
  maxTouchPoints?: number;
}

/**
 * Phones and tablets use the native camera app (better focus, exposure and resolution than
 * getUserMedia). Touch-screen laptops do not count; iPadOS reports itself as a Mac with touch.
 */
export function isMobileDevice(
  device: DeviceInfo | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): boolean {
  if (!device) return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent)) return true;
  return /Macintosh/i.test(device.userAgent) && (device.maxTouchPoints ?? 0) > 1;
}

/** `ideal` above any common webcam makes the browser pick the highest resolution it supports. */
export function buildCameraConstraints(facingMode: CameraFacingMode): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 4096 },
      height: { ideal: 2160 },
    },
    audio: false,
  };
}

/** `torch` is not in the DOM typings and getCapabilities is missing in some browsers. */
export function supportsTorch(track: { getCapabilities?: () => object } | null | undefined): boolean {
  if (!track || typeof track.getCapabilities !== 'function') return false;
  return (track.getCapabilities() as { torch?: boolean }).torch === true;
}
