import { describe, expect, it } from 'vitest'
import { ApiError } from './problem-detail'

describe('ApiError', () => {
  it('uses the RFC 9457 detail as its message', () => {
    const error = new ApiError({ code: 'NETWORK_ACTIVE', detail: 'La red está activa.', traceId: 'abc' }, 409)
    expect(error.message).toBe('La red está activa.')
    expect(error.problem.traceId).toBe('abc')
  })
})
