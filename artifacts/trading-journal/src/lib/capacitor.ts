import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNativePlatform = Capacitor.isNativePlatform();

/**
 * Apply native-only shell behavior without affecting the browser preview.
 * The config and native projects are intentionally managed outside the CLI.
 */
export async function initializeNativeShell() {
  if (!isNativePlatform) return;

  document.documentElement.classList.add("native-shell");

  await Promise.allSettled([
    SplashScreen.hide({ fadeOutDuration: 200 }),
    StatusBar.setStyle({ style: Style.Light }),
    StatusBar.setOverlaysWebView({ overlay: true }),
  ]);
}

export function triggerNativeHaptic(style: ImpactStyle = ImpactStyle.Light) {
  if (!isNativePlatform) return;

  void Haptics.impact({ style }).catch(() => {
    // Haptics can be unavailable on some native devices and should never
    // interrupt the action that triggered them.
  });
}