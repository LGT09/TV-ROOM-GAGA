import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { ProviderError } from "../providers/http"

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new ProviderError("Secure media routing is not configured.", 503)
  return createHash("sha256").update(secret).digest()
}
export function seal<T>(purpose: string, data: T, seconds = 86400): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify({ purpose, data, exp: Date.now() + seconds * 1000 })), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")
}
export function unseal<T>(token: string, purpose: string): T {
  try {
    if (!token || token.length > 16000) throw new Error("Invalid key")
    const body = Buffer.from(token, "base64url")
    const decipher = createDecipheriv("aes-256-gcm", key(), body.subarray(0, 12))
    decipher.setAuthTag(body.subarray(12, 28))
    const value = JSON.parse(Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]).toString())
    if (value.purpose !== purpose || value.exp < Date.now()) throw new Error("Expired key")
    return value.data
  } catch { throw new ProviderError("This link is invalid or expired. Refresh the library and select the title again.", 400) }
}
