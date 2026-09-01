export type PageResponse<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number }

export type Snapshot = {
  id: number; networkId: number; status: string; indexStatus: string
  startTime: string | null; endTime: string | null; size: number | null
  validSize: number | null; transformedSize: number | null; deleted: boolean
}
export type MetadataCleanupPreview = { networkId: number; protectedSnapshotIds: number[]; oaiReferences: number; validationReferences: number; metadataEntriesScanned: number; orphanCandidates: number; falsePositiveProbability: number }

export type DiagnosticFilterField = 'IDENTIFIER' | 'VALID' | 'TRANSFORMED' | 'RULE_VALID' | 'RULE_INVALID'
export type DiagnosticFilter = { field: DiagnosticFilterField; operator?: 'EQ' | 'CONTAINS'; value: string | boolean | number }
export type DiagnosticQuery = { filters: DiagnosticFilter[]; page?: number; size?: number }
export type DiagnosticFacet = { field: string; value: string; count: number }
export type DiagnosticRule = { ruleId: number; name: string; description: string | null; quantifier: string | null; mandatory: boolean | null; validCount: number | null; invalidCount: number | null }
export type DiagnosticSummary = { size: number; validSize: number; transformedSize: number; rules: DiagnosticRule[]; facets: DiagnosticFacet[] }
export type DiagnosticRecord = {
  id: string; identifier: string; snapshotId: number; origin: string | null; setSpec: string | null; metadataPrefix: string | null
  networkAcronym: string | null; repositoryName: string | null; institutionName: string | null; valid: boolean | null; transformed: boolean | null
  validRuleIds: string[]; invalidRuleIds: string[]; validOccurrencesByRuleId: Record<string, string[]>; invalidOccurrencesByRuleId: Record<string, string[]>
}
export type RuleOccurrence = { value: string; count: number }
export type RuleOccurrences = { ruleId: number; valid: RuleOccurrence[]; invalid: RuleOccurrence[] }
export type SnapshotLogEntry = { timestamp: string; message: string }

export type RuntimeState = { runningCount: number; queuedCount: number; scheduledCount: number; running: string[]; queued: string[]; scheduled: string[] }

export type NetworkSummary = {
  id: number; published: boolean; acronym: string; name: string; institutionName: string
  institutionAcronym: string | null; latestSnapshot: Snapshot | null; lastValidSnapshotId: number | null
  lastValidSnapshotAt: string | null; runtime: RuntimeState
}

export type Network = {
  id: number; published: boolean; acronym: string; name: string; institutionName: string
  institutionAcronym: string | null; originUrl: string; metadataPrefix: string | null
  metadataStoreSchema: string | null; sets: string[]; attributes: Record<string, unknown>
  properties: Record<string, boolean>; scheduleCronExpression: string | null
  prevalidatorId: number | null; validatorId: number | null; transformerId: number | null; secondaryTransformerId: number | null
}

export type NetworkRequest = Omit<Network, 'id'>
export type NetworkImportMode = 'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT'
export type NetworkImportRow = { row: number; acronym: string; operation: 'CREATE' | 'UPDATE'; errors: string[]; warnings: string[]; valid: boolean }
export type NetworkImportValidation = { format: string; version: number; mode: NetworkImportMode; totalRows: number; validRows: number; invalidRows: number; rows: NetworkImportRow[] }
export type NetworkImportResult = { validation: NetworkImportValidation; created: number; updated: number }

export type NamedConfiguration = { id: number; name: string; description: string | null }
export type ConfigurationExport = { format: string; version: number; kind: 'validator' | 'transformer'; exportedAt: string; configuration: Record<string, unknown> }
export type Rule = {
  id?: number; typeId: string; className?: string; name: string; description: string | null
  mandatory?: boolean | null; quantifier?: string | null; runOrder?: number | null
  configuration: Record<string, unknown>
}
export type ValidatorConfiguration = NamedConfiguration & { rules: Rule[] }
export type TransformerConfiguration = NamedConfiguration & { rules: Rule[] }
export type RuleType = {
  typeId: string; kind: 'validator' | 'transformer'; className: string; name: string
  help: string | null; schema: Record<string, unknown>; uiSchema: Record<string, unknown>
}
export type Usage = { used: boolean; networks: Array<{ id: number; acronym: string; name: string; relations: string[] }> }
export type AttributeProfile = {
  typeId: string; name: string; className: string; version: string
  schema: Record<string, unknown>; uiSchema: Record<string, unknown>
}

export type CapabilityAction = { name: string; description: string; incremental: boolean; runOnSchedule: boolean | null; alwaysRunOnSchedule: boolean | null; order: number | null; workers: string[]; properties: string[] }
export type Capabilities = {
  engineType: string; actions: CapabilityAction[]; properties: Array<{ name: string; description: string }>
  metadataFormats: string[]; metadataStoreSchemas: string[]; commands: string[]
}

export type RuntimeProcess = {
  processId: string; networkAcronym: string; actionType: string; status: string; startTime: string | null
  incremental: boolean | null; engineType: string; cancellationScope: 'NETWORK' | 'PROCESS'; variables: Record<string, unknown>
}

export type RuntimeSummary = { engineType: string; runningCount: number; queuedCount: number; processes: RuntimeProcess[] }
export type CurrentUser = { username: string; displayName: string; roles: string[]; authMode: 'file' | 'oidc' }
export type ManagedUser = { username: string; roles: string[] }
export type CommandType = 'RUN_ACTION' | 'RUN_ENABLED_ACTIONS' | 'CANCEL_ALL' | 'RESCHEDULE'
export type CommandRequest = { type: CommandType; actionName?: string; incremental?: boolean }
export type CommandReceipt = { requestId: string; networkId: number; command: CommandType; result: 'ACCEPTED' | 'REJECTED'; acceptedAt: string; runtimeUrl: string; message: string | null }
export type BatchCommandReceipt = { requestId: string; acceptedAt: string; children: CommandReceipt[] }
export type ApiProblem = { status?: number; title?: string; detail?: string; code?: string; traceId?: string; violations?: Array<{ field: string; message: string }> }

export type ApplicationActionState = 'ENABLED' | 'DISABLED' | 'UNAVAILABLE' | 'INVALID_CONFIGURATION'
export type ApplicationAction = {
  id: number; engineType: 'legacy' | 'flowable'; actionKey: string; state: ApplicationActionState
  order?: number | null; enabled: boolean; available: boolean; definition: { name?: string; description?: string; incremental?: boolean; schedulable?: boolean; workers?: string[] }
  configuration: Record<string, unknown>; schema: Record<string, unknown>; uiSchema: Record<string, unknown>
  problems: string[]; lastSeenAt: string | null; updatedAt: string; updatedBy: string | null
}
export type ApplicationActionUsage = { used: boolean; networkCount: number; scheduleCount: number; networks: Usage['networks'] }
export type ApplicationActionRefresh = { engineType: string; bootstrap: boolean; created: number; updated: number; unavailable: number; conflicts: string[] }
export type WorkerConfiguration = { id: number; engineType: 'legacy' | 'flowable'; workerKey: string; available: boolean; definition: { key?: string; beanName?: string }; configuration: Record<string, unknown>; schema: Record<string, unknown>; lastSeenAt: string | null; updatedAt: string; updatedBy: string | null }
export type DarkSummary = { total: number; states: Array<{ state: string; count: number }>; naans: Array<{ arkNaan: string; total: number }>; naanStates?: Array<{ arkNaan: string; state: string; count: number }> }
export type DarkConfiguration = { configuration: Record<string, unknown> }
export type DarkRecord = { arkNaan: string; oaiId: string; ark: string | null; targetUrl: string | null; state: string; sourceMetadataHash: string | null; stagePayloadHash: string | null; lastError: string | null; createdAt: string; updatedAt: string; lastStagedAt: string | null; lastReconciledAt: string | null; publishedAt: string | null }
export type NetworkActionConfiguration = { actionKey: string; order?: number | null; globalState: ApplicationActionState; enabled: boolean; scheduleEnabled: boolean; configuration: Record<string, unknown>; effectiveConfiguration: Record<string, unknown>; schema: Record<string, unknown>; uiSchema: Record<string, unknown>; problems: string[]; updatedAt: string; updatedBy: string | null }
