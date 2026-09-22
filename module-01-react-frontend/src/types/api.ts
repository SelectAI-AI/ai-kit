// Shared TypeScript types for the Module 01 React frontend API layer

// ── API Status ───────────────────────────────────────────────────────────────

export interface ApiStatusResponse {
  connected: boolean
  langsmith_project: string | null
  groq_model: string
}

// ── Step 1 ───────────────────────────────────────────────────────────────────

export interface CheckEnvResponse {
  vars_present: string[]
  vars_missing: string[]
}

// ── Step 2 ───────────────────────────────────────────────────────────────────

export interface InvokeModelRequest {
  query: string
  temperature: number
}

export interface InvokeModelResponse {
  response: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

// ── Step 3 ───────────────────────────────────────────────────────────────────

export type PromptTechnique =
  | 'zero_shot'
  | 'few_shot'
  | 'cot'
  | 'role'
  | 'json_output'
  | 'multi_step'

export interface PromptTechniqueRequest {
  technique: PromptTechnique
  user_input: string
}

export interface PromptTechniqueResponse {
  response: string
  technique: PromptTechnique
}

// ── Step 4 ───────────────────────────────────────────────────────────────────

export type ChainType = 'basic' | 'json' | 'pydantic'

export interface InvokeChainRequest {
  chain_type: ChainType
  query: string
}

export interface QueryAnalysisOutput {
  category: 'technical' | 'creative' | 'general'
  confidence: number
  reasoning: string
}

export interface InvokeChainResponse {
  output: string | Record<string, unknown> | QueryAnalysisOutput
  chain_type: ChainType
}

// ── Step 5 ───────────────────────────────────────────────────────────────────

export interface RouteQueryRequest {
  query: string
}

export interface RouteQueryResponse {
  category: string
  response: string
}

// ── Step 6 ───────────────────────────────────────────────────────────────────

export interface DimScores {
  correctness: number
  relevance: number
}

export interface EvalResultsResponse {
  dataset_name: string
  example_count: number
  aggregate_score: number
  dim_scores: DimScores
  has_results: boolean
}

// ── Shared ───────────────────────────────────────────────────────────────────

export interface ApiError {
  status?: number
  message: string
}

export interface HealthResponse {
  status: string
}

// ── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressState {
  [stepIndex: number]: boolean // keys 1–6
}

// ── Legacy aliases (kept for backward compat with existing pages) ─────────────

export interface ClassifyRequest {
  query: string
}

export interface ClassifyResponse {
  category: string
  response: string
}

export interface ChecklistState {
  [index: number]: boolean
}
