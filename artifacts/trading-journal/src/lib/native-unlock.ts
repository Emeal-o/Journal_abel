import { Preferences } from "@capacitor/preferences";

export const NATIVE_UNLOCK_KEYS = {
  hasSeenOffer: "hasSeenUnlockSetupOffer",
  pinHash: "nativeUnlockPinHash",
  passwordHash: "nativeUnlockPasswordHash",
} as const;

async function digestSecret(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hasSeenNativeUnlockOffer(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.hasSeenOffer });
  return value === "true";
}

export async function markNativeUnlockOfferSeen(): Promise<void> {
  await Preferences.set({ key: NATIVE_UNLOCK_KEYS.hasSeenOffer, value: "true" });
}

export async function saveNativePin(pin: string): Promise<void> {
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.pinHash,
    value: await digestSecret(pin),
  });
}

export async function saveNativePassword(password: string): Promise<void> {
  await Preferences.set({
    key: NATIVE_UNLOCK_KEYS.passwordHash,
    value: await digestSecret(password),
  });
}

export async function verifyNativePin(pin: string): Promise<boolean> {
  return verifySecret(NATIVE_UNLOCK_KEYS.pinHash, pin);
}

export async function verifyNativePassword(password: string): Promise<boolean> {
  return verifySecret(NATIVE_UNLOCK_KEYS.passwordHash, password);
}

async function verifySecret(key: string, secret: string): Promise<boolean> {
  const { value } = await Preferences.get({ key });
  if (!value) return false;
  return value === await digestSecret(secret);
}

export async function hasNativePin(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.pinHash });
  return Boolean(value);
}

export async function hasNativePassword(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_UNLOCK_KEYS.passwordHash });
  return Boolean(value);
}