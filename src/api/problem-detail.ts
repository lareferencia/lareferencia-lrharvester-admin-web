import type { ApiProblem } from './types'

export class ApiError extends Error {
  constructor(public readonly problem: ApiProblem, public readonly status: number) {
    super(problem.detail || problem.title || `Error HTTP ${status}`)
  }
}

export async function asApiError(response: Response): Promise<ApiError> {
  let problem: ApiProblem = { status: response.status, title: response.statusText }
  if (response.headers.get('content-type')?.includes('json')) {
    problem = { ...problem, ...await response.json() as ApiProblem }
  }
  return new ApiError(problem, response.status)
}
