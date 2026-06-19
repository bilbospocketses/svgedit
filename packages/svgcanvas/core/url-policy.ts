// Shared same-origin fetch policy for user-influenced URLs. Used by the
// export-time image inliner (#34) and the `?url=` content loader (#45): a URL
// is fetchable only if it resolves to an http(s) URL on the editor's own
// origin. This closes browser-side SSRF / blind cross-origin GETs from an
// attacker-supplied URL. Relative URLs resolve same-origin (allowed);
// cross-origin, protocol-relative, and non-http schemes (file:, data:,
// javascript:, blob:) are rejected.

export function isSameOriginHttpUrl (url: string): boolean {
  try {
    const u = new URL(url, document.baseURI)
    return (u.protocol === 'http:' || u.protocol === 'https:') &&
      u.origin === window.location.origin
  } catch {
    return false
  }
}
