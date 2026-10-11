import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, SecureCookieHttpError } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('ApiClient login CSRF cookie check', () => {
  it('explains the HTTP secure-cookie problem before sending credentials', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'csrf-token' }) })
    vi.stubGlobal('fetch', fetch)

    await expect(new ApiClient('/api/v5').login('admin', 'password'))
      .rejects.toBeInstanceOf(SecureCookieHttpError)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('continues login when the browser received the matching CSRF cookie', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/'
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf-token' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ username: 'admin' }) })
    vi.stubGlobal('fetch', fetch)

    await expect(new ApiClient('/api/v5').login('admin', 'password'))
      .resolves.toEqual({ username: 'admin' })

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('Authentication errors', () => {
  it('does not invalidate the session for a forbidden request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))
    const client = new ApiClient('/api/v5')
    const unauthorized = vi.fn()
    client.setUnauthorizedHandler(unauthorized)
    await expect(client.runtime()).rejects.toMatchObject({ status: 403 })
    expect(unauthorized).not.toHaveBeenCalled()
  })
})
