
"use client"

import { useState } from "react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const body = new URLSearchParams()
      body.append("username", email)
      body.append("password", password)

      const res = await fetch("http://localhost:8000/auth/jwt/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        // fastapi-users typically returns { detail: ... }
        setError((data && (data.detail || data)) || `Login failed (${res.status})`)
        setLoading(false)
        return
      }

      const token = (data && (data.access_token || data.token))
      if (!token) {
        setError("No access token returned by server")
        setLoading(false)
        return
      }

      // store token in localStorage
      try {
        localStorage.setItem("access_token", token)
      } catch (e) {
        // ignore storage errors
      }

      // also set a non-HttpOnly cookie for convenience (not secure for sensitive apps)
      try {
        document.cookie = `access_token=${token}; path=/`
      } catch (e) {}

      // redirect to home
      window.location.href = "/"
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Email:
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Password:
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ color: "red" }}>
          {String(error)}
        </div>
      )}
    </form>
  )
}