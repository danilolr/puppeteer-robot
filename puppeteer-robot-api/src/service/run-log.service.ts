import { Injectable, Logger } from '@nestjs/common'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

interface RunLogParams {
  requestedAt: Date
  durationMs: number
  request: unknown
  response?: unknown
  error?: unknown
}

@Injectable()
export class RunLogService {
  private readonly logger = new Logger(RunLogService.name)

  async saveRunLog(params: RunLogParams): Promise<void> {
    const logsPath = process.env.LOGS_PATH?.trim()
    if (!logsPath) {
      return
    }

    try {
      await mkdir(logsPath, { recursive: true })
      const timestamp = this.formatTimestamp(params.requestedAt)
      const fileName = `run-${timestamp}-${randomUUID()}.json`
      const filePath = join(logsPath, fileName)

      const payload = {
        endpoint: '/puppeteer-robot/run',
        method: 'PUT',
        requestedAt: params.requestedAt.toISOString(),
        durationMs: params.durationMs,
        request: params.request,
        response: params.response,
        error: params.error ? this.formatError(params.error) : undefined,
      }

      await writeFile(filePath, this.stringifyJson(payload), { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      this.logger.error(`Failed to write /run log: ${this.formatErrorMessage(error)}`)
    }
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-')
  }

  private stringifyJson(value: unknown): string {
    return `${JSON.stringify(this.toJsonValue(value), null, 2)}\n`
  }

  private toJsonValue(value: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof value === 'bigint') {
      return value.toString()
    }

    if (value instanceof Error) {
      return this.formatError(value)
    }

    if (Array.isArray(value)) {
      return value.map(item => this.toJsonValue(item, seen))
    }

    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)

      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.toJsonValue(item, seen)])
      )
    }

    return value
  }

  private formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    return {
      message: String(error),
    }
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }

    return String(error)
  }
}
