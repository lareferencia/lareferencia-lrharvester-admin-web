export type RuntimeConfig = {
  apiBaseUrl: string
  defaultLocale: 'es' | 'pt' | 'en'
}

const fallback: RuntimeConfig = { apiBaseUrl: '/api/v5', defaultLocale: 'es' }

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/admin/config.json', { cache: 'no-store' })
  if (!response.ok) return fallback
  const candidate = await response.json() as Partial<RuntimeConfig>
  return {
    apiBaseUrl: candidate.apiBaseUrl?.replace(/\/$/, '') || fallback.apiBaseUrl,
    defaultLocale: candidate.defaultLocale === 'pt' || candidate.defaultLocale === 'en' ? candidate.defaultLocale : 'es',
  }
}
