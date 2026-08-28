import { asApiError } from './problem-detail'
import type { ApplicationAction, ApplicationActionRefresh, ApplicationActionUsage, AttributeProfile, Capabilities, CommandReceipt, CommandRequest, CommandType, CurrentUser, DiagnosticQuery, DiagnosticRecord, DiagnosticSummary, NamedConfiguration, Network, NetworkActionConfiguration, NetworkRequest, NetworkSummary, PageResponse, RuleOccurrences, RuleType, RuntimeSummary, Snapshot, SnapshotLogEntry, TransformerConfiguration, Usage, ValidatorConfiguration } from './types'

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

  private async requestText(path: string): Promise<string> {
    const headers = new Headers({ Accept: 'application/xml' })
    if (this.credentials) headers.set('Authorization', `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`)
    const response = await fetch(`${this.baseUrl}${path}`, { headers })
    if (!response.ok) throw await asApiError(response)
    return response.text()
  }

  me() { return this.request<CurrentUser>('/me') }
  networkSummaries(params: URLSearchParams) { return this.request<PageResponse<NetworkSummary>>(`/network-summaries?${params}`) }
  network(id: number) { return this.request<Network>(`/networks/${id}`) }
  networkSnapshots(id: number) { return this.request<PageResponse<Snapshot>>(`/networks/${id}/snapshots?page=0&size=100`) }
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
  applicationActions() { return this.request<ApplicationAction[]>('/application-actions') }
  applicationActionUsage(actionKey: string) { return this.request<ApplicationActionUsage>(`/application-actions/${encodeURIComponent(actionKey)}/usage`) }
  updateApplicationAction(actionKey: string, enabled: boolean, configuration: Record<string, unknown>) {
    return this.request<ApplicationAction>(`/application-actions/${encodeURIComponent(actionKey)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, configuration }) })
  }
  refreshApplicationActions() { return this.request<ApplicationActionRefresh>('/application-actions/refresh', { method: 'POST' }) }
  networkActions(id: number) { return this.request<NetworkActionConfiguration[]>(`/networks/${id}/actions`) }
  updateNetworkAction(id: number, actionKey: string, request: Pick<NetworkActionConfiguration, 'enabled' | 'scheduleEnabled' | 'configuration'>) {
    return this.request<NetworkActionConfiguration>(`/networks/${id}/actions/${encodeURIComponent(actionKey)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  }
  networkRuntime(id: number) { return this.request<RuntimeSummary['processes']>(`/networks/${id}/runtime`) }
  diagnosticSummary(snapshotId: number, filters: DiagnosticQuery['filters']) { return this.request<DiagnosticSummary>(`/snapshots/${snapshotId}/diagnostics/summary/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters }) }) }
  diagnosticRecords(snapshotId: number, query: DiagnosticQuery) { return this.request<PageResponse<DiagnosticRecord>>(`/snapshots/${snapshotId}/diagnostics/records/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) }) }
  diagnosticOccurrences(snapshotId: number, ruleId: number, filters: DiagnosticQuery['filters']) { return this.request<RuleOccurrences>(`/snapshots/${snapshotId}/diagnostics/rules/${ruleId}/occurrences/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters }) }) }
  diagnosticMetadata(snapshotId: number, identifier: string) { return this.requestText(`/snapshots/${snapshotId}/diagnostics/records/metadata?identifier=${encodeURIComponent(identifier)}`) }
  snapshotLogs(snapshotId: number) { return this.request<PageResponse<SnapshotLogEntry>>(`/snapshots/${snapshotId}/logs?page=0&size=100`) }
  runtime() { return this.request<RuntimeSummary>('/runtime/summary') }
  command(id: number, command: CommandType | CommandRequest): Promise<CommandReceipt> {
    const request = typeof command === 'string' ? { type: command } : command
    return this.request(`/networks/${id}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  }
}
