import { closeServer, createServer } from './httpServer.js'
import { resolveWebPort } from './resolveWebPort.js'

const HOST = '0.0.0.0'

async function main (): Promise<void> {
  const port = await resolveWebPort()
  const server = createServer()
  server.listen(port, HOST, () => {
    process.stdout.write(`svgedit server listening on http://localhost:${port}/\n`)
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
