import { getSetting, setSetting } from "./db";

const SALT_KEY = "security.salt";
const VERIFY_IV_KEY = "security.verifyIv";
const VERIFY_CIPHER_KEY = "security.verifyCipher";
const VERIFY_TEXT = "poetry-recite-unlock";

const SESSION_PASSWORD_KEY = "poetry.master.session.password";
const REMEMBER_PASSWORD_KEY = "poetry.master.remember.password";
const REMEMBER_UNTIL_KEY = "poetry.master.remember.until";

let sessionKey: CryptoKey | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function setSessionPassword(password: string): void {
  sessionStorage.setItem(SESSION_PASSWORD_KEY, btoa(unescape(encodeURIComponent(password))));
}

function getSessionPassword(): string | null {
  const value = sessionStorage.getItem(SESSION_PASSWORD_KEY);
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return null;
  }
}

function setRememberPassword(password: string, rememberForDay: boolean): void {
  if (!rememberForDay) {
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
    localStorage.removeItem(REMEMBER_UNTIL_KEY);
    return;
  }

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem(REMEMBER_PASSWORD_KEY, btoa(unescape(encodeURIComponent(password))));
  localStorage.setItem(REMEMBER_UNTIL_KEY, String(expiresAt));
}

function getRememberPassword(): string | null {
  const value = localStorage.getItem(REMEMBER_PASSWORD_KEY);
  const until = Number(localStorage.getItem(REMEMBER_UNTIL_KEY) || "0");
  if (!value || !until || until < Date.now()) {
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
    localStorage.removeItem(REMEMBER_UNTIL_KEY);
    return null;
  }

  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
    localStorage.removeItem(REMEMBER_UNTIL_KEY);
    return null;
  }
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations: 120000,
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(key: CryptoKey, text: string): Promise<{ iv: string; cipher: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    encoder.encode(text)
  );

  return {
    iv: toBase64(iv),
    cipher: toBase64(new Uint8Array(encrypted))
  };
}

async function decryptText(key: CryptoKey, ivB64: string, cipherB64: string): Promise<string> {
  const iv = fromBase64(ivB64);
  const data = fromBase64(cipherB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(data)
  );
  return new TextDecoder().decode(decrypted);
}

async function unlockWithPassword(password: string): Promise<boolean> {
  const [saltB64, ivB64, cipherB64] = await Promise.all([
    getSetting(SALT_KEY),
    getSetting(VERIFY_IV_KEY),
    getSetting(VERIFY_CIPHER_KEY)
  ]);

  if (!saltB64 || !ivB64 || !cipherB64) {
    return false;
  }

  try {
    const key = await deriveKey(password, fromBase64(saltB64));
    const text = await decryptText(key, ivB64, cipherB64);
    if (text !== VERIFY_TEXT) {
      return false;
    }
    sessionKey = key;
    return true;
  } catch {
    return false;
  }
}

export async function hasMasterPassword(): Promise<boolean> {
  const salt = await getSetting(SALT_KEY);
  return Boolean(salt);
}

export async function initializeMasterPassword(password: string, rememberForDay = true): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const verify = await encryptText(key, VERIFY_TEXT);

  await setSetting(SALT_KEY, toBase64(salt));
  await setSetting(VERIFY_IV_KEY, verify.iv);
  await setSetting(VERIFY_CIPHER_KEY, verify.cipher);

  sessionKey = key;
  setSessionPassword(password);
  setRememberPassword(password, rememberForDay);
}

export async function unlockMasterPassword(password: string, rememberForDay = true): Promise<boolean> {
  const ok = await unlockWithPassword(password);
  if (!ok) {
    return false;
  }

  setSessionPassword(password);
  setRememberPassword(password, rememberForDay);
  return true;
}

export async function tryAutoUnlock(): Promise<boolean> {
  if (sessionKey) {
    return true;
  }

  const fromSession = getSessionPassword();
  if (fromSession) {
    const ok = await unlockWithPassword(fromSession);
    if (ok) {
      return true;
    }
  }

  const fromRemember = getRememberPassword();
  if (fromRemember) {
    const ok = await unlockWithPassword(fromRemember);
    if (ok) {
      setSessionPassword(fromRemember);
      return true;
    }
  }

  return false;
}

export function lockSession(clearRemember = false): void {
  sessionKey = null;
  sessionStorage.removeItem(SESSION_PASSWORD_KEY);
  if (clearRemember) {
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
    localStorage.removeItem(REMEMBER_UNTIL_KEY);
  }
}

export function isSessionUnlocked(): boolean {
  return Boolean(sessionKey);
}

export async function encryptSecret(secret: string): Promise<{ cipher: string; iv: string }> {
  if (!sessionKey) {
    throw new Error("Session is locked.");
  }
  const encrypted = await encryptText(sessionKey, secret);
  return { cipher: encrypted.cipher, iv: encrypted.iv };
}

export async function decryptSecret(cipher: string, iv: string): Promise<string> {
  if (!sessionKey) {
    throw new Error("Session is locked.");
  }
  return decryptText(sessionKey, iv, cipher);
}
