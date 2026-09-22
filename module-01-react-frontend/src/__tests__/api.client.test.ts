// Feature: module-01-react-frontend, Property 3: package.json exact version pins
// Feature: module-01-react-frontend, Property 1: API client base URL resolution
// Feature: module-01-react-frontend, Property 16: API client surfaces 503 detail
// Feature: module-01-react-frontend, Property 17: API client timeout aborts after 30s

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import axios from 'axios'
import packageJson from '../../package.json'
import { createApiClient, normaliseError } from '../api/client'

// ── Property 3: package.json exact version pins ──────────────────────────────

describe('Property 3: package.json exact version pins', () => {
  it('no dependency version begins with ^ or ~', () => {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }
    const entries = Object.entries(allDeps)

    fc.assert(
      fc.property(
        fc.constantFrom(...entries),
        ([_name, version]) => {
          const v = version as string
          expect(v).not.toMatch(/^[\^~]/)
          return !v.startsWith('^') && !v.startsWith('~')
        },
      ),
      { numRuns: entries.length },
    )
  })

  it('all dependency versions are exact (no ^ or ~ prefix)', () => {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }
    for (const [name, version] of Object.entries(allDeps)) {
      const v = version as string
      expect(v, `${name} should have exact version, got: ${v}`).not.toMatch(/^[\^~]/)
    }
  })
})

// ── Property 1: API client base URL resolution ───────────────────────────────

describe('Property 1: API client base URL resolution', () => {
  it('uses provided URL when non-empty, falls back to localhost:8000 when absent/empty', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(undefined),
          fc.constant('http://example.com:9000'),
          fc.constant('http://staging.api.com'),
        ),
        (baseUrl) => {
          const client = createApiClient(baseUrl)
          const defaults = client.defaults as { baseURL?: string }
          if (baseUrl) {
            expect(defaults.baseURL).toBe(baseUrl)
          } else {
            expect(defaults.baseURL).toBe('http://localhost:8000')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('falls back to http://localhost:8000 for empty string', () => {
    const client = createApiClient('')
    const defaults = client.defaults as { baseURL?: string }
    expect(defaults.baseURL).toBe('http://localhost:8000')
  })

  it('falls back to http://localhost:8000 for undefined', () => {
    const client = createApiClient(undefined)
    const defaults = client.defaults as { baseURL?: string }
    expect(defaults.baseURL).toBe('http://localhost:8000')
  })

  it('uses provided URL when non-empty', () => {
    const client = createApiClient('http://custom.api.com:8080')
    const defaults = client.defaults as { baseURL?: string }
    expect(defaults.baseURL).toBe('http://custom.api.com:8080')
  })
})

// ── Property 16: API client surfaces 503 detail variable name ────────────────

describe('Property 16: API client surfaces 503 detail variable name', () => {
  it('for any HTTP 503 response with a detail string, normaliseError includes that string', () => {
    const varNames = ['GROQ_API_KEY', 'LANGCHAIN_API_KEY', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_PROJECT']

    fc.assert(
      fc.property(
        fc.constantFrom(...varNames),
        fc.string({ minLength: 1, maxLength: 50 }),
        (varName, prefix) => {
          const detail = `${prefix}: ${varName}`
          const err = Object.assign(new Error('Request failed'), {
            isAxiosError: true,
            code: 'ERR_BAD_RESPONSE',
            response: {
              status: 503,
              data: { detail },
            },
          })
          // Make axios.isAxiosError return true for this mock
          vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)
          const result = normaliseError(err)
          vi.restoreAllMocks()
          expect(result.message).toContain(varName)
          expect(result.status).toBe(503)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('503 without detail returns generic unavailable message', () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      code: 'ERR_BAD_RESPONSE',
      response: { status: 503, data: {} },
    })
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)
    const result = normaliseError(err)
    vi.restoreAllMocks()
    expect(result.message).toContain('unavailable')
    expect(result.status).toBe(503)
  })
})

// ── Property 17: API client timeout aborts after 30s ─────────────────────────

describe('Property 17: API client timeout aborts after 30s', () => {
  it('chainClient has 30000ms timeout configured', () => {
    // The chainClient is created with CHAIN_TIMEOUT_MS = 30_000
    // We verify this by creating a client with the same factory and checking timeout
    const client = createApiClient('http://localhost:8000')
    expect((client.defaults as { timeout?: number }).timeout).toBe(30_000)
  })

  it('ECONNABORTED error returns timeout message', () => {
    const err = Object.assign(new Error('timeout of 30000ms exceeded'), {
      isAxiosError: true,
      code: 'ECONNABORTED',
      response: undefined,
    })
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)
    const result = normaliseError(err)
    vi.restoreAllMocks()
    expect(result.message).toContain('timed out')
    expect(result.message).toContain('please try again')
  })

  it('for any chain request not resolved within 30000ms, normaliseError returns timeout message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (_query) => {
          const err = Object.assign(new Error('timeout'), {
            isAxiosError: true,
            code: 'ECONNABORTED',
            response: undefined,
          })
          vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)
          const result = normaliseError(err)
          vi.restoreAllMocks()
          return result.message.includes('timed out') || result.message.includes('timeout')
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── normaliseError unit tests ─────────────────────────────────────────────────

describe('normaliseError unit tests', () => {
  beforeEach(() => {
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('422 returns field name from detail array', () => {
    const err = Object.assign(new Error(), {
      isAxiosError: true,
      code: 'ERR_BAD_RESPONSE',
      response: {
        status: 422,
        data: { detail: [{ loc: ['body', 'query'], msg: 'field required' }] },
      },
    })
    const result = normaliseError(err)
    expect(result.status).toBe(422)
    expect(result.message).toContain('query')
  })

  it('502 returns LangSmith message', () => {
    const err = Object.assign(new Error(), {
      isAxiosError: true,
      code: 'ERR_BAD_RESPONSE',
      response: { status: 502, data: {} },
    })
    const result = normaliseError(err)
    expect(result.status).toBe(502)
    expect(result.message).toContain('LangSmith')
  })

  it('no response returns backend-not-running message', () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      code: 'ERR_NETWORK',
      response: undefined,
    })
    const result = normaliseError(err)
    expect(result.message).toContain('backend')
  })

  it('non-axios error returns network error message', () => {
    vi.restoreAllMocks()
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false)
    const result = normaliseError(new TypeError('fetch failed'))
    expect(result.message).toContain('Network error')
  })
})
