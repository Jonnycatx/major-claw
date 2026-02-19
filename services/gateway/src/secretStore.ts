import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

export interface SecretStore {
  put(scope: string, value: string): string;
  get(ref: string): string | null;
}

// Temporary adapter hook for v1 migration. Replace internals with OS keychain-backed implementation.
export class GatewaySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();
  private readonly masterKey = this.resolveMasterKey();

  put(scope: string, value: string): string {
    const ref = `${scope}:${randomUUID()}`;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = JSON.stringify({
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: encrypted.toString("base64")
    });
    this.values.set(ref, payload);
    return ref;
  }

  get(ref: string): string | null {
    const encryptedPayload = this.values.get(ref);
    if (!encryptedPayload) {
      return null;
    }
    try {
      const payload = JSON.parse(encryptedPayload) as { iv: string; tag: string; data: string };
      const decipher = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      return null;
    }
  }

  private resolveMasterKey(): Buffer {
    const supplied = process.env.MAJORCLAW_SECRET_STORE_KEY?.trim();
    if (supplied) {
      return createHash("sha256").update(supplied, "utf8").digest();
    }
    return randomBytes(32);
  }
}
