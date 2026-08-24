// lib/auth.ts
const AUTH_KEY = "auth_session"
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const AUTH_CONFIG = {
  username: "admin",
  passwordHash: "4ea52923003f58c297cf2f605c1b49e4876154ebf514f176fdca074de17f89a2", 
}

export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false

  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return false

  try {
    const { expiresAt } = JSON.parse(raw)
    if (Date.now() > expiresAt) {
      localStorage.removeItem(AUTH_KEY)
      return false
    }
    return true
  } catch {
    localStorage.removeItem(AUTH_KEY)
    return false
  }
}

export function setAuthenticated() {
  const expiresAt = Date.now() + THIRTY_DAYS_MS
  localStorage.setItem(AUTH_KEY, JSON.stringify({ expiresAt }))
}

export function logout() {
  localStorage.removeItem(AUTH_KEY)
}