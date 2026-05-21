export function isOriginAllowed (origin: string, allowedOrigins: readonly string[]): boolean {
  if (allowedOrigins.length === 0) return false
  if (allowedOrigins.includes('*')) return true
  return allowedOrigins.includes(origin)
}

export function parseAllowedOrigins (raw: string): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0)
}
