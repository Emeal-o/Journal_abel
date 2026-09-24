import { Preferences } from "@capacitor/preferences";

export const NATIVE_UNLOCK_KEYS = {
  hasSeenOffer: "hasSeenUnlockSetupOffer",
  pinHash: "nativeUnlockPinHash",
  passwordHash: "nativeUnlockPasswordHash",
  salt: "nativeUnlockSalt",
  method: "nativeUnlockMethod",
  biometricEnabled: "nativeUnlockBiometricEnabled",
} as const;

export type NativeUnlockMethod = "pin" | "password";

async function digestSecret(secret: string, salt?: string): Promise<string> {
  const bytes = new TextEncoder().encode(salt ? `${salt}:${secret}` : secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrCreateSalt(): Promise<string> {
  const existing = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.salt });
  if (existing.value) return existing.value;

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  await Preferences.set({ key: NATIVE_UNLOCK_KEYS.salt, value: salt });
  return salt;
}

async function clearNativeUnlockCredential(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: NATIVE_UNLOCK_KEYS.pinHash }),
    Preferences.remove({ key: NATIVE_UNLOCK_KEYS.passwordHash }),
    Preferences.remove({ key: NATIVE_UNLOCK_KEYS.salt }),
    Preferences.remove({ key: NATIVE_UNLOCK_KEYS.method }),
    Preferences.remove({ key: NATIVE_UNLOCK_KEYS.biometricEnabled }),
  ]);
}

export async function hasSeenNativeUnlockOffer(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.hasSeenOffer });
  return value === "true";
}

export async function markNativeUnlockOfferSeen(): Promise<void> {
  await Preferences.set({ key: NATIVE_UNLOCK_KEYS.hasSeenOffer, value: "true" });
}

export async function getNativeBiometricEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.biometricEnabled });
  return value === "true";
}

export async function setNativeBiometricEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.biometricEnabled,
    value: String(enabled),
  });
}

export async function saveNativePin(pin: string): Promise<void> {
  await clearNativeUnlockCredential();
  const salt = await getOrCreateSalt();
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.pinHash,
    value: await digestSecret(pin, salt),
  });
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.method,
    value: "pin",
  });
}

export async function saveNativePassword(password: string): Promise<void> {
  await clearNativeUnlockCredential();
  const salt = await getOrCreateSalt();
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.passwordHash,
    value: await digestSecret(password, salt),
  });
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.method,
    value: "password",
  });
}

export async function verifyNativePin(pin: string): Promise<boolean> {
  return verifySecret(NATIVE_UNLOCK_KEYS.pinHash, pin);
}

export async function verifyNativePassword(password: string): Promise<boolean> {
  return verifySecret(NATIVE_UNLOCK_KEYS.passwordHash, password);
}

async function verifySecret(key: string, secret: string): Promise<boolean> {
  const [{ value: storedHash }, { value: salt }] = await Promise.all([
    Preferences.get({ key }),
    Preferences.get({ key: NATIVE_UNLOCK_KEYS.salt }),
  ]);
  if (!storedHash) return false;

  if (salt && storedHash === await digestSecret(secret, salt)) {
    return true;
  }

  // Part 1 stored unsalted SHA-256 hashes. Keep those values usable once,
  // then migrate them to the salted format without storing the raw secret.
  if (storedHash !== await digestSecret(secret)) return false;
  const nextSalt = salt ?? await getOrCreateSalt();
  await Preferences.set({
    key,
    value: await digestSecret(secret, nextSalt),
  });
  return true;
}

export async function hasNativePin(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.pinHash });
  return Boolean(value);
}

export async function hasNativePassword(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.passwordHash });
  return Boolean(value);
}

export async function getNativeUnlockMethod(): Promise<NativeUnlockMethod | null> {
  const configured = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.method });
  if (configured.value === "pin" && await hasNativePin()) {
    return configured.value;
  }
  if (configured.value === "password" && await hasNativePassword()) {
    return configured.value;
  }

  // Compatibility for values created before the method preference existed.
  if (await hasNativePin()) return "pin";
  if (await hasNativePassword()) return "password";
  return null;
}