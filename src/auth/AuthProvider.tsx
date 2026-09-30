import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { ApiClient } from '../api/client'
import type { CurrentUser } from '../api/types'

type AuthState = { user: CurrentUser | null; login: (username: string, password: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ client, children }: PropsWithChildren<{ client: ApiClient }>) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  useEffect(() => {
    let active = true
    void client.me().then(current => { if (active) setUser(current) }).catch(() => {
      if (active) setUser(null)
    })
    return () => { active = false }
  }, [client])
  const value = useMemo<AuthState>(() => ({
    user,
    login: async (username, password) => { setUser(await client.login(username, password)) },
    logout: async () => { try { await client.logout() } finally { setUser(null) } },
  }), [client, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
