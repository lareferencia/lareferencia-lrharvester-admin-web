import { describe, expect, it, vi } from 'vitest'
import { loadRuntimeConfig } from './config'

describe('loadRuntimeConfig', () => {
  it('normalizes a configured API base URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ apiBaseUrl: 'https://example.test/api/v5/', authMode: 'file', defaultLocale: 'pt' }) }))
    await expect(loadRuntimeConfig()).resolves.toEqual({ apiBaseUrl: 'https://example.test/api/v5', authMode: 'file', defaultLocale: 'pt' })
    vi.unstubAllGlobals()
  })
})
