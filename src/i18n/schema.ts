import i18n from './index'

/** Translate known field labels without changing schema values or validation rules. */
export function localizeSchema(schema: Record<string, unknown>, namespace = 'schemaFields'): Record<string, unknown> {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
  return {
    ...schema,
    ...(properties && { properties: Object.fromEntries(Object.entries(properties).map(([name, field]) => [name, {
      ...localizeSchema(field, namespace),
      title: i18n.t(`${namespace}.${name}`, { defaultValue: String(field.title || name) }),
    }])) }),
    ...(schema.items !== undefined && schema.items !== null && typeof schema.items === 'object' && !Array.isArray(schema.items) && { items: localizeSchema(schema.items as Record<string, unknown>, namespace) }),
  }
}

/** RJSF uses ui:enumNames for labels; the API still receives the original enum values. */
export function localizeProfileUiSchema(schema: Record<string, unknown>, uiSchema: Record<string, unknown>, fieldName?: string): Record<string, unknown> {
  const result = { ...uiSchema }
  if (Array.isArray(schema.enum)) {
    result['ui:enumNames'] = schema.enum.map(value => {
      const country = fieldName === 'country' ? countryCode(String(value)) : undefined
      return country ? new Intl.DisplayNames([i18n.resolvedLanguage || 'es'], { type: 'region' }).of(country) || String(value)
        : i18n.t(`profileOptions.${String(value)}`, { defaultValue: String(value) })
    })
  }
  for (const [name, field] of Object.entries((schema.properties || {}) as Record<string, Record<string, unknown>>)) {
    result[name] = localizeProfileUiSchema(field, (uiSchema[name] || {}) as Record<string, unknown>, name)
  }
  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    result.items = localizeProfileUiSchema(schema.items as Record<string, unknown>, (uiSchema.items || {}) as Record<string, unknown>, fieldName)
  }
  return result
}

function countryCode(value: string): string | undefined {
  if (/^[A-Z]{2}$/.test(value)) return value
  const codes: Record<string, string> = { Argentina: 'AR', Bolivia: 'BO', Brasil: 'BR', Chile: 'CL', Colombia: 'CO', 'Costa Rica': 'CR', Cuba: 'CU', Ecuador: 'EC', 'El Salvador': 'SV', España: 'ES', Guatemala: 'GT', Honduras: 'HN', México: 'MX', Nicaragua: 'NI', Panamá: 'PA', Paraguay: 'PY', Perú: 'PE', Portugal: 'PT', 'Puerto Rico': 'PR', 'República Dominicana': 'DO', Uruguay: 'UY', Venezuela: 'VE' }
  return codes[value]
}
