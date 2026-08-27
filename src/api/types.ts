export type PageResponse<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number }

export type Snapshot = {
  id: number; networkId: number; status: string; indexStatus: string
  startTime: string | null; endTime: string | null; size: number | null
  validSize: number | null; transformedSize: number | null; deleted: boolean
}

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

export type NamedConfiguration = { id: number; name: string; description: string | null }
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

export type CapabilityAction = { name: string; description: string; incremental: boolean; runOnSchedule: boolean | null; alwaysRunOnSchedule: boolean | null; displayOrder: number | null; workers: string[]; properties: string[] }
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
export type CommandType = 'RUN_ACTION' | 'RUN_ENABLED_ACTIONS' | 'CANCEL_ALL' | 'RESCHEDULE'
export type CommandRequest = { type: CommandType; actionName?: string; incremental?: boolean }
export type CommandReceipt = { requestId: string; networkId: number; command: CommandType; result: 'ACCEPTED' | 'REJECTED'; acceptedAt: string; runtimeUrl: string; message: string | null }
export type ApiProblem = { status?: number; title?: string; detail?: string; code?: string; traceId?: string; violations?: Array<{ field: string; message: string }> }
