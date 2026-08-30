import { asApiError } from './problem-detail'
import type { ApplicationAction, ApplicationActionRefresh, ApplicationActionUsage, AttributeProfile, Capabilities, CommandReceipt, CommandRequest, CommandType, ConfigurationExport, CurrentUser, DiagnosticQuery, DiagnosticRecord, DiagnosticSummary, MetadataCleanupPreview, NamedConfiguration, Network, NetworkActionConfiguration, NetworkImportMode, NetworkImportResult, NetworkImportValidation, NetworkRequest, NetworkSummary, PageResponse, Rule, RuleOccurrences, RuleType, RuntimeSummary, Snapshot, SnapshotLogEntry, TransformerConfiguration, Usage, ValidatorConfiguration, WorkerConfiguration } from './types'

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

  private async requestBlob(path: string): Promise<Blob> {
    const headers = new Headers()
    if (this.credentials) headers.set('Authorization', `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`)
    const response = await fetch(`${this.baseUrl}${path}`, { headers })
    if (!response.ok) throw await asApiError(response)
    return response.blob()
  }

  me() { return this.request<CurrentUser>('/me') }
  networkSummaries(params: URLSearchParams) { return this.request<PageResponse<NetworkSummary>>(`/network-summaries?${params}`) }
  network(id: number) { return this.request<Network>(`/networks/${id}`) }
  createNetwork(request: NetworkRequest) { return this.request<Network>('/networks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  exportNetworksXlsx() { return this.requestBlob('/network-transfers/export.xlsx') }
  validateNetworkImport(file: File, mode: NetworkImportMode) {
    const body = new FormData(); body.append('file', file)
    return this.request<NetworkImportValidation>(`/network-transfers/import/validate?mode=${mode}`, { method: 'POST', body })
  }
  importNetworksXlsx(file: File, mode: NetworkImportMode) {
    const body = new FormData(); body.append('file', file)
    return this.request<NetworkImportResult>(`/network-transfers/import?mode=${mode}`, { method: 'POST', body })
  }
  networkSnapshots(id: number) { return this.request<PageResponse<Snapshot>>(`/networks/${id}/snapshots?page=0&size=100`) }
  updateNetwork(id: number, request: NetworkRequest) {
    return this.request<Network>(`/networks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  }
  validators() { return this.request<PageResponse<NamedConfiguration>>('/validators?page=0&size=200') }
  transformers() { return this.request<PageResponse<NamedConfiguration>>('/transformers?page=0&size=200') }
  validator(id: number) { return this.request<ValidatorConfiguration>(`/validators/${id}`) }
  transformer(id: number) { return this.request<TransformerConfiguration>(`/transformers/${id}`) }
  exportValidator(id: number) { return this.request<ConfigurationExport>(`/validators/${id}/export`) }
  exportTransformer(id: number) { return this.request<ConfigurationExport>(`/transformers/${id}/export`) }
  importValidator(value: ConfigurationExport) { return this.request<ValidatorConfiguration>('/validators/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) }
  importTransformer(value: ConfigurationExport) { return this.request<TransformerConfiguration>('/transformers/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) }
  ruleTypes(kind: 'validator' | 'transformer', locale = 'es') { return this.request<RuleType[]>(`/rule-types?kind=${kind}&locale=${encodeURIComponent(locale)}`) }
  validatorUsage(id: number) { return this.request<Usage>(`/validators/${id}/usage`) }
  transformerUsage(id: number) { return this.request<Usage>(`/transformers/${id}/usage`) }
  createValidator(request: Omit<ValidatorConfiguration, 'id'>) { return this.request<ValidatorConfiguration>('/validators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  updateValidator(id: number, request: Omit<ValidatorConfiguration, 'id'>) { return this.request<ValidatorConfiguration>(`/validators/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  updateValidatorMetadata(id: number, request: Pick<ValidatorConfiguration, 'name' | 'description'>) { return this.request<ValidatorConfiguration>(`/validators/${id}/metadata`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  createTransformer(request: Omit<TransformerConfiguration, 'id'>) { return this.request<TransformerConfiguration>('/transformers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  updateTransformer(id: number, request: Omit<TransformerConfiguration, 'id'>) { return this.request<TransformerConfiguration>(`/transformers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  updateTransformerMetadata(id: number, request: Pick<TransformerConfiguration, 'name' | 'description'>) { return this.request<TransformerConfiguration>(`/transformers/${id}/metadata`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }) }
  saveConfigurationRule(kind: 'validator' | 'transformer', configurationId: number, rule: Rule) {
    const payload = { ...rule, className: undefined }
    const base = `/${kind}s/${configurationId}/rules`
    return rule.id
      ? this.request<Rule>(`${base}/${rule.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : this.request<Rule>(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  }
  deleteConfigurationRule(kind: 'validator' | 'transformer', configurationId: number, ruleId: number) { return this.request<void>(`/${kind}s/${configurationId}/rules/${ruleId}`, { method: 'DELETE' }) }
  reorderConfigurationRules(kind: 'validator' | 'transformer', configurationId: number, ruleIds: number[]) { return this.request<Rule[]>(`/${kind}s/${configurationId}/rules/order`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruleIds }) }) }
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
  moveApplicationAction(actionKey: string, direction: 'UP' | 'DOWN') {
    return this.request<ApplicationAction>(`/application-actions/${encodeURIComponent(actionKey)}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction }) })
  }
  refreshApplicationActions() { return this.request<ApplicationActionRefresh>('/application-actions/refresh', { method: 'POST' }) }
  workerConfigurations() { return this.request<WorkerConfiguration[]>('/worker-configurations') }
  updateWorkerConfiguration(workerKey: string, configuration: Record<string, unknown>) { return this.request<WorkerConfiguration>(`/worker-configurations/${encodeURIComponent(workerKey)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ configuration }) }) }
  networkActions(id: number) { return this.request<NetworkActionConfiguration[]>(`/networks/${id}/actions`) }
  updateNetworkAction(id: number, actionKey: string, request: Pick<NetworkActionConfiguration, 'enabled' | 'scheduleEnabled' | 'configuration'>) {
    return this.request<NetworkActionConfiguration>(`/networks/${id}/actions/${encodeURIComponent(actionKey)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  }
  networkRuntime(id: number) { return this.request<RuntimeSummary['processes']>(`/networks/${id}/runtime`) }
  previewMetadataCleanup(id: number) { return this.request<MetadataCleanupPreview>(`/networks/${id}/metadata-cleanup/preview`, { method: 'POST' }) }
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
