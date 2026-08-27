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

export type RuntimeProcess = {
  processId: string; networkAcronym: string; actionType: string; status: string; startTime: string | null
  incremental: boolean | null; engineType: string; cancellationScope: 'NETWORK' | 'PROCESS'; variables: Record<string, unknown>
}

export type RuntimeSummary = { engineType: string; runningCount: number; queuedCount: number; processes: RuntimeProcess[] }
export type CurrentUser = { username: string; displayName: string; roles: string[]; authMode: 'file' | 'oidc' }
export type CommandType = 'RUN_ACTION' | 'RUN_ENABLED_ACTIONS' | 'CANCEL_ALL' | 'RESCHEDULE'
export type CommandReceipt = { requestId: string; networkId: number; command: CommandType; result: 'ACCEPTED' | 'REJECTED'; acceptedAt: string; runtimeUrl: string; message: string | null }
export type ApiProblem = { status?: number; title?: string; detail?: string; code?: string; traceId?: string; violations?: Array<{ field: string; message: string }> }
