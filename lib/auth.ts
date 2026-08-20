// lib/auth.ts

// Hash 1 chuỗi bằng SHA-256, trả về hex string
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Thông tin đăng nhập hợp lệ (đã hash sẵn, không lưu plaintext)
// Tạo hash bằng cách chạy: await sha256("mật khẩu của bạn") trong console
export const AUTH_CONFIG = {
  username: "admin",
  passwordHash: "4ea52923003f58c297cf2f605c1b49e4876154ebf514f176fdca074de17f89a2", 
}

const SESSION_KEY = "dashboard_auth"

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(SESSION_KEY) === "true"
}

export function setAuthenticated() {
  sessionStorage.setItem(SESSION_KEY, "true")
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}