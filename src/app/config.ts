export type RuntimeConfig = {
  apiBaseUrl: string
  authMode: 'file' | 'oidc'
  defaultLocale: 'es' | 'pt' | 'en'
}

const fallback: RuntimeConfig = { apiBaseUrl: '/api/v5', authMode: 'file', defaultLocale: 'es' }

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/config.json', { cache: 'no-store' })
  if (!response.ok) return fallback
  const candidate = await response.json() as Partial<RuntimeConfig>
  return {
    apiBaseUrl: candidate.apiBaseUrl?.replace(/\/$/, '') || fallback.apiBaseUrl,
    authMode: candidate.authMode === 'oidc' ? 'oidc' : 'file',
    defaultLocale: candidate.defaultLocale === 'pt' || candidate.defaultLocale === 'en' ? candidate.defaultLocale : 'es',
  }
}
