export const queryKeys = {
  me: ['me'] as const,
  networkSummaries: (query: string) => ['network-summaries', query] as const,
  network: (id: number) => ['network', id] as const,
  networkRuntime: (id: number) => ['network-runtime', id] as const,
  runtime: ['runtime'] as const,
}
