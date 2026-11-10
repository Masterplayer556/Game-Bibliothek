// AES-256-GCM for platform tokens. Uses Web Crypto only, so the exact same code runs in
// Node (sync script) and in Deno (Supabase Edge Functions).
// Format: v1:<iv base64>:<ciphertext+tag base64>

const VERSION = "v1";

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(keyBase64.trim());
  } catch {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not valid base64");
  }
  if (raw.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64 encoded)");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return `${VERSION}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(payload: string, keyBase64: string): Promise<string> {
  const [version, ivPart, dataPart, ...rest] = payload.split(":");
  if (version !== VERSION || !ivPart || !dataPart || rest.length > 0) {
    throw new Error("Unknown credential format");
  }
  const key = await importKey(keyBase64);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivPart) },
      key,
      fromBase64(dataPart),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Credential could not be decrypted (wrong key or corrupted data)");
  }
}

/** New random key, base64. Generated in the browser on the setup screen; never logged. */
export function generateKey(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)));
}
