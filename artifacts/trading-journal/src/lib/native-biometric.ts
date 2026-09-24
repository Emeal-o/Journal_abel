import { NativeBiometric } from "capacitor-native-biometric";
import { isNativePlatform } from "@/lib/capacitor";
import { getNativeBiometricEnabled } from "@/lib/native-unlock";

export async function isNativeBiometricAvailable(): Promise<boolean> {
  if (!isNativePlatform) return false;
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: false });
    return result.isAvailable;
  } catch {
    return false;
  }
}

async function promptForNativeBiometricIdentity(): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Unlock your TradeOps journal",
      title: "Unlock TradeOps",
      subtitle: "Use your enrolled biometric to continue",
      description: "Your PIN or password remains available as a fallback.",
      negativeButtonText: "Use PIN or password",
      useFallback: false,
    });
    return true;
  } catch {
    // Cancellation, failure, lockout, and unavailable states all fall back
    // to the same screen without creating a dead end or a blocking error.
    return false;
  }
}

/** Runs the operating-system biometric prompt without checking the saved preference. */
export async function requestNativeBiometricVerification(): Promise<boolean> {
  if (!isNativePlatform) return false;
  return promptForNativeBiometricIdentity();
}

export async function requestNativeBiometricUnlock(): Promise<boolean> {
  if (!isNativePlatform) return false;
  if (!await getNativeBiometricEnabled()) return false;
  return promptForNativeBiometricIdentity();
}