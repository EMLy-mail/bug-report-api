import net from 'net'
import { spawn } from 'child_process'

const host = process.env.MYSQL_HOST || 'mysql'
const port = parseInt(process.env.MYSQL_PORT || '3306', 10)
const retryDelay = 2000

function waitForPort(host: string, port: number) {
  return new Promise<void>((resolve) => {
    const tryConnect = () => {
      const socket = new net.Socket()
      socket.setTimeout(2000)
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        setTimeout(tryConnect, retryDelay)
      })
      socket.once('timeout', () => {
        socket.destroy()
        setTimeout(tryConnect, retryDelay)
      })
      socket.connect(port, host)
    }
    tryConnect()
  })
}

;(async () => {
  console.log(`Waiting for MySQL at ${host}:${port}...`)
  await waitForPort(host, port)
  console.log('MySQL is available - starting API.')
  const child = spawn('bun', ['run', 'src/index.ts'], { stdio: 'inherit' })
  ;['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) =>
    process.on(sig as NodeJS.Signals, () => child.kill(sig as NodeJS.Signals))
  )
})()
