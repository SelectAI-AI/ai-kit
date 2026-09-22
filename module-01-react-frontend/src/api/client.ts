import axios, { AxiosInstance } from 'axios'
import { getStoredKeys } from '../hooks/useApiKeys'
import type {
  ApiError,
  ApiStatusResponse,
  CheckEnvResponse,
  InvokeModelRequest,
  InvokeModelResponse,
  PromptTechniqueRequest,
  PromptTechniqueResponse,
  InvokeChainRequest,
  InvokeChainResponse,
  RouteQueryRequest,
  RouteQueryResponse,
  EvalResultsResponse,
  HealthResponse,
  // Legacy
  ClassifyRequest,
  ClassifyResponse,
} from '../types/api'

const FALLBACK_BASE_URL = 'http://localhost:8000'
const CHAIN_TIMEOUT_MS = 30_000

// Read VITE_API_BASE_URL at module load time
const _envUrl: string =
  typeof import.meta !== 'undefined'
    ? (((import.meta as unknown) as { env?: { VITE_API_BASE_URL?: string } }).env
        ?.VITE_API_BASE_URL ?? '')
    : ''

/**
 * Factory — creates an Axios instance with the given baseUrl.
 * Falls back to FALLBACK_BASE_URL when baseUrl is empty or undefined.
 */
export function createApiClient(baseUrl?: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl || FALLBACK_BASE_URL,
    timeout: CHAIN_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** chainClient — 30 s timeout; used for all step POST endpoints */
export const chainClient = createApiClient(_envUrl)

/** dataClient — no timeout override; used for GET /api/status, /api/steps/6/eval, /api/health */
export const dataClient = axios.create({
  baseURL: _envUrl || FALLBACK_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Inject student API keys as headers on every request
function addKeyHeaders(config: import('axios').InternalAxiosRequestConfig) {
  const keys = getStoredKeys()
  if (keys.groqApiKey) config.headers['X-Groq-Api-Key'] = keys.groqApiKey
  if (keys.langchainApiKey) config.headers['X-Langchain-Api-Key'] = keys.langchainApiKey
  if (keys.langchainTracingV2) config.headers['X-Langchain-Tracing-V2'] = keys.langchainTracingV2
  if (keys.langchainProject) config.headers['X-Langchain-Project'] = keys.langchainProject
  return config
}

chainClient.interceptors.request.use(addKeyHeaders)
dataClient.interceptors.request.use(addKeyHeaders)

// Legacy aliases
export const apiClient = chainClient
export const noTimeoutClient = dataClient

/**
 * Converts any thrown value into a typed ApiError.
 *
 * Error mapping:
 *  - ECONNABORTED          → timeout message
 *  - HTTP 503 with detail  → surfaces the variable name from detail
 *  - HTTP 503 no detail    → generic unavailable message
 *  - HTTP 422              → field name from detail array
 *  - HTTP 502              → LangSmith message
 *  - No response           → backend-not-running message
 */
export function normaliseError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const detail = err.response?.data?.detail

    if (err.code === 'ECONNABORTED') {
      return { message: 'Request timed out. The model may be slow — please try again.' }
    }

    if (status === 503) {
      if (detail) {
        return { status, message: `Backend unavailable: ${detail}` }
      }
      return {
        status,
        message:
          'The backend service is unavailable. Check that all required environment variables are set.',
      }
    }

    if (status === 422) {
      const fieldName = Array.isArray(detail)
        ? (detail[0]?.loc?.slice(-1)[0] ?? 'unknown field')
        : 'unknown field'
      return { status, message: `Validation error on field: ${fieldName}` }
    }

    if (status === 502) {
      return {
        status,
        message:
          'LangSmith is unreachable. Check your LANGCHAIN_API_KEY and network connection.',
      }
    }

    if (!err.response) {
      return { message: 'Network error — is the backend running on port 8000?' }
    }

    return {
      status,
      message:
        err.response?.data?.detail ?? `Request failed (HTTP ${status ?? 'unknown'})`,
    }
  }

  return { message: 'Network error — is the backend running on port 8000?' }
}

// ---------------------------------------------------------------------------
// Spec typed functions
// ---------------------------------------------------------------------------

export async function getApiStatus(): Promise<ApiStatusResponse> {
  const res = await dataClient.get<ApiStatusResponse>('/api/status')
  return res.data
}

export async function checkEnv(): Promise<CheckEnvResponse> {
  const res = await dataClient.post<CheckEnvResponse>('/api/steps/1/check-env')
  return res.data
}

export async function invokeModel(params: InvokeModelRequest): Promise<InvokeModelResponse> {
  const res = await chainClient.post<InvokeModelResponse>('/api/steps/2/invoke', params)
  return res.data
}

export async function runPromptTechnique(
  params: PromptTechniqueRequest,
): Promise<PromptTechniqueResponse> {
  const res = await chainClient.post<PromptTechniqueResponse>('/api/steps/3/prompt', params)
  return res.data
}

export async function invokeChain(params: InvokeChainRequest): Promise<InvokeChainResponse> {
  const res = await chainClient.post<InvokeChainResponse>('/api/steps/4/chain', params)
  return res.data
}

export async function routeQuery(params: RouteQueryRequest): Promise<RouteQueryResponse> {
  const res = await chainClient.post<RouteQueryResponse>('/api/steps/5/route', params)
  return res.data
}

export async function getEvalResults(): Promise<EvalResultsResponse> {
  const res = await dataClient.get<EvalResultsResponse>('/api/steps/6/eval')
  return res.data
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await dataClient.get<HealthResponse>('/api/health')
  return res.data
}

// ---------------------------------------------------------------------------
// Legacy functions (kept for backward compat with existing pages/tests)
// ---------------------------------------------------------------------------

export async function invokeChainLegacy(
  params: InvokeChainRequest,
): Promise<InvokeChainResponse> {
  const res = await chainClient.post<InvokeChainResponse>('/api/chain/invoke', params)
  return res.data
}

export async function classifyQuery(params: ClassifyRequest): Promise<ClassifyResponse> {
  const res = await chainClient.post<ClassifyResponse>('/api/classify', params)
  return res.data
}

export async function getEvalResultsLegacy(): Promise<EvalResultsResponse> {
  const res = await dataClient.get<EvalResultsResponse>('/api/eval/results')
  return res.data
}
