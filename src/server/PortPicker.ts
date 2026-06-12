import * as net from 'node:net'

/** Bind-test a single port. Resolves true if free, false if busy. Closes the
 *  test server immediately on success so the port is reusable by the real listener. */
export function tryPort (port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()
    let settled = false
    const done = (free: boolean): void => {
      if (settled) return
      settled = true
      try { server.close() } catch { /* ignore */ }
      resolve(free)
    }
    server.once('error', () => { done(false) })
    server.once('listening', () => {
      settled = true
      server.close(() => { resolve(true) })
    })
    server.listen(port)
  })
}

/** Parse the SVGEDIT_WEB_PORT override into a valid port, or null. */
export function webPortOverride (env: string | undefined): number | null {
  const n = Number(env)
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null
}

/** Walk [start, end] inclusive in order; return the first free port, or null. */
export async function findAvailablePort (start: number, end: number): Promise<number | null> {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null
  for (let port = start; port <= end; port++) {
    const free = await tryPort(port)
    if (free) return port
  }
  return null
}
