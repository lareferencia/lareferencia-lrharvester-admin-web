export const queryKeys = {
  me: ['me'] as const,
  networkSummaries: (query: string) => ['network-summaries', query] as const,
  network: (id: number) => ['network', id] as const,
  networkRuntime: (id: number) => ['network-runtime', id] as const,
  validators: ['validators'] as const,
  validator: (id: number) => ['validator', id] as const,
  transformers: ['transformers'] as const,
  transformer: (id: number) => ['transformer', id] as const,
  ruleTypes: (kind: 'validator' | 'transformer') => ['rule-types', kind] as const,
  attributeProfiles: ['attribute-profiles'] as const,
  capabilities: ['capabilities'] as const,
  runtime: ['runtime'] as const,
}
