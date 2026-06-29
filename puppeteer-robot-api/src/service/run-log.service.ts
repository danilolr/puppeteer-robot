import { Injectable, Logger } from '@nestjs/common'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

interface RunLogParams {
  operationName: string
  robotId: string
  sessionId?: string
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
      const robotId = this.formatPathSegment(params.robotId || 'unknown-robot')
      const sessionId = this.formatPathSegment(params.sessionId || 'unknown-session')
      const logDir = join(logsPath, robotId, sessionId)
      await mkdir(logDir, { recursive: true })

      const timestamp = this.formatTimestamp(params.requestedAt)
      const operationName = this.formatOperationName(params.operationName)
      const fileName = `${operationName}-${timestamp}-${randomUUID()}.json`
      const filePath = join(logDir, fileName)

      const payload = {
        operationName: params.operationName,
        robotId: params.robotId,
        sessionId: params.sessionId,
        requestedAt: params.requestedAt.toISOString(),
        durationMs: params.durationMs,
        request: params.request,
        response: params.response,
        error: params.error ? this.formatError(params.error) : undefined,
      }

      await writeFile(filePath, this.stringifyJson(payload), { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      this.logger.error(`Failed to write ${params.operationName} log: ${this.formatErrorMessage(error)}`)
    }
  }

  private formatOperationName(operationName: string): string {
    return operationName.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  private formatPathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_.-]/g, '_')
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
