import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type AuthCtx = {
  token: string | null
  login: (password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bp_token'))

  useEffect(() => {
    if (token) localStorage.setItem('bp_token', token)
    else localStorage.removeItem('bp_token')
  }, [token])

  const login = async (password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) throw new Error('Invalid password')
    const { token } = await res.json() as { token: string }
    setToken(token)
  }

  const logout = () => setToken(null)

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
