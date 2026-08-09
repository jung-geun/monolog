import * as fs from 'fs'
import * as path from 'path'
import type { NextApiRequest } from 'next'
import { getIp } from 'src/libs/utils/security'

export function ensureLogDir(): string {
  const logDir = path.resolve(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  return logDir
}

export function resolveLogFile(fileName: string): string {
  return path.join(ensureLogDir(), fileName)
}

export function appendJsonLog(filePath: string, record: unknown): void {
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n')
}

export function getRequestIp(req: NextApiRequest): string {
  return getIp(req)
}
