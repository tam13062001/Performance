"use client"

import { useState, useEffect } from "react"
import { sha256, AUTH_CONFIG, isAuthenticated, setAuthenticated } from "@/lib/auth"
import { Lock, Eye, EyeOff } from "lucide-react"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAuthed(isAuthenticated())
    setChecked(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const inputHash = await sha256(password)

    if (username === AUTH_CONFIG.username && inputHash === AUTH_CONFIG.passwordHash) {
      setAuthenticated()
      setAuthed(true)
    } else {
      setError("Sai username hoặc password")
    }
    setLoading(false)
  }

  if (!checked) return null

  if (!authed) {
    return (
      <div className="container">
        {/* Cột trái: branding */}
        <div className="brandSide">
          <div className="brandContent">
            <div className="brandIcon">
              <Lock size={32} color="#fff" />
            </div>
            <h1 className="brandTitle">Dashboard</h1>
            <p className="brandDesc">
              Khu vực quản trị được bảo vệ. Vui lòng đăng nhập để tiếp tục.
            </p>
          </div>
        </div>

        {/* Cột phải: form */}
        <div className="formSide">
          <form onSubmit={handleSubmit} className="form">
            <div className="mobileIcon">
              <div className="mobileIconBox">
                <Lock size={24} color="#fff" />
              </div>
            </div>

            <div className="header">
              <h2 className="title">Đăng nhập</h2>
              <p className="subtitle">
                Nhập thông tin để truy cập dashboard
              </p>
            </div>

            <div className="fields">
              <div className="fieldGroup">
                <label className="label">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>

              <div className="fieldGroup">
                <label className="label">Password</label>
                <div className="passwordWrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input passwordInput"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="toggleBtn"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" disabled={loading} className="submitBtn">
              {loading ? "Đang kiểm tra..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <>{children}</>
}