export function isOriginAllowed (origin: string, allowedOrigins: readonly string[]): boolean {
  if (allowedOrigins.length === 0) return false
  if (allowedOrigins.includes('*')) return true
  return allowedOrigins.includes(origin)
}

/** A syntactically valid, path-less origin (`scheme://host[:port]`). */
function isValidOrigin (s: string): boolean {
  try {
    return new URL(s).origin === s
  } catch {
    return false
  }
}

/**
 * Parse a comma-separated allowedOrigins list from an untrusted source (URL params).
 * Each entry must be a real origin; `*` and malformed tokens are dropped so a crafted
 * URL cannot silently widen the embed to every origin (#29). A programmatic
 * `opts.allowedOrigins` bypasses this and may still use `*` as a dev escape hatch.
 */
export function parseAllowedOrigins (raw: string): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0 && isValidOrigin(s))
}
