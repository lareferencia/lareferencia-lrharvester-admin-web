import { asApiError } from './problem-detail'
import type { CommandReceipt, CommandType, CurrentUser, Network, NetworkSummary, PageResponse, RuntimeSummary } from './types'

export type Credentials = { username: string; password: string }

export class ApiClient {
  private credentials: Credentials | null = null

  constructor(private readonly baseUrl: string) {}

  setCredentials(credentials: Credentials | null) { this.credentials = credentials }

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
  networkRuntime(id: number) { return this.request<RuntimeSummary['processes']>(`/networks/${id}/runtime`) }
  runtime() { return this.request<RuntimeSummary>('/runtime/summary') }
  command(id: number, type: CommandType): Promise<CommandReceipt> {
    return this.request(`/networks/${id}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
  }
}
