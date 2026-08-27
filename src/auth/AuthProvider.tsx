import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { ApiClient, Credentials } from '../api/client'
import type { CurrentUser } from '../api/types'

type AuthState = { user: CurrentUser | null; login: (credentials: Credentials) => Promise<void>; logout: () => void }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ client, children }: PropsWithChildren<{ client: ApiClient }>) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  // Fast Refresh can preserve React state while recreating ApiClient. Do not
  // leave an apparent ADMIN session when the in-memory Basic credential is gone.
  useEffect(() => {
    if (!client.hasCredentials()) {
      setUser(null)
      return
    }
    let active = true
    void client.me().then(current => { if (active) setUser(current) }).catch(() => {
      if (active) {
        client.setCredentials(null)
        setUser(null)
      }
    })
    return () => { active = false }
  }, [client])
  const value = useMemo<AuthState>(() => ({
    user,
    login: async (credentials) => { client.setCredentials(credentials); try { setUser(await client.me()) } catch (error) { client.setCredentials(null); throw error } },
    logout: () => { client.setCredentials(null); setUser(null) },
  }), [client, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
