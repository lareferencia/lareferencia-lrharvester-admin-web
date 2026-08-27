import { asApiError } from './problem-detail'
import type { AttributeProfile, Capabilities, CommandReceipt, CommandRequest, CommandType, CurrentUser, NamedConfiguration, Network, NetworkRequest, NetworkSummary, PageResponse, RuleType, RuntimeSummary, TransformerConfiguration, Usage, ValidatorConfiguration } from './types'

export type Credentials = { username: string; password: string }

export class ApiClient {
  private credentials: Credentials | null = null

  constructor(private readonly baseUrl: string) {}

  setCredentials(credentials: Credentials | null) { this.credentials = credentials }
  hasCredentials() { return this.credentials !== null }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (this.credentials) headers.set('Authorization', `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`)
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (!response.ok) throw await asApiError(response)
    return response.status === 204 ? undefined as T : response.json() as Promise<T>
  }

  me() { return this.request<CurrentUser>('/me') }
  networkSummaries(params: URLSearchParams) { return this.request<PageResponse<NetworkSummary>>(`/network-summaries?${params}`) }
  network(id: number) { return this.request<Network>(`/networks/${id}`) }
  updateNetwork(id: number, request: NetworkRequest) {
    return this.request<Network>(`/networks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  }
  validators() { return this.request<PageResponse<NamedConfiguration>>('/validators?page=0&size=200') }
  transformers() { return this.request<PageResponse<NamedConfiguration>>('/transformers?page=0&size=200') }
  validator(id: number) { return this.request<ValidatorConfiguration>(`/validators/${id}`) }
  transformer(id: number) { return this.request<TransformerConfiguration>(`/transformers/${id}`) }
  ruleTypes(kind: 'validator' | 'transformer') { return this.request<RuleType[]>(`/rule-types?kind=${kind}&locale=es`) }
  validatorUsage(id: number) { return this.request<Usage>(`/validators/${id}/usage`) }
  transformerUsage(id: number) { return this.request<Usage>(`/transformers/${id}/usage`) }
  createValidator(request: Omit<ValidatorConfiguration, 'id'>) { return this.request<ValidatorConfiguration>('/validators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  updateValidator(id: number, request: Omit<ValidatorConfiguration, 'id'>) { return this.request<ValidatorConfiguration>(`/validators/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  createTransformer(request: Omit<TransformerConfiguration, 'id'>) { return this.request<TransformerConfiguration>('/transformers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  updateTransformer(id: number, request: Omit<TransformerConfiguration, 'id'>) { return this.request<TransformerConfiguration>(`/transformers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  cloneValidator(id: number) { return this.request<ValidatorConfiguration>(`/validators/${id}/clone`, { method: 'POST' }) }
  cloneTransformer(id: number) { return this.request<TransformerConfiguration>(`/transformers/${id}/clone`, { method: 'POST' }) }
  deleteValidator(id: number) { return this.request<void>(`/validators/${id}`, { method: 'DELETE' }) }
  deleteTransformer(id: number) { return this.request<void>(`/transformers/${id}`, { method: 'DELETE' }) }
  attributeProfiles() { return this.request<AttributeProfile[]>('/attribute-profiles') }
  capabilities() { return this.request<Capabilities>('/capabilities') }
  networkRuntime(id: number) { return this.request<RuntimeSummary['processes']>(`/networks/${id}/runtime`) }
  runtime() { return this.request<RuntimeSummary>('/runtime/summary') }
  command(id: number, command: CommandType | CommandRequest): Promise<CommandReceipt> {
    const request = typeof command === 'string' ? { type: command } : command
    return this.request(`/networks/${id}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  }
}
