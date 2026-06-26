import { closeServer, createServer, resolveBindHost } from './httpServer.js'
import { resolveWebPort } from './resolveWebPort.js'

const HOST = resolveBindHost()
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

async function main (): Promise<void> {
  const port = await resolveWebPort()
  // Enforce the Host allow-list on the secure default (loopback); an explicit
  // non-loopback bind via SVGEDIT_BIND_HOST is opt-in LAN exposure, so relax it.
  const server = createServer(LOOPBACK_HOSTS.has(HOST) ? {} : { allowedHosts: null })
  server.listen(port, HOST, () => {
    // Bracket IPv6 literals so the logged URL is well-formed (e.g. http://[::1]:8100/).
    const displayHost = HOST.includes(':') ? `[${HOST}]` : HOST
    process.stdout.write(`svgedit server listening on http://${displayHost}:${port}/\n`)
  })

  const shutdown = (): void => {
    process.stdout.write('\nsvgedit server shutting down\n')
    closeServer(server)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((err: unknown) => {
  process.stderr.write(`svgedit server failed to start: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
