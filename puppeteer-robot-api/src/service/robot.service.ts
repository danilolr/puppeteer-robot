import { Injectable } from "@nestjs/common/decorators/core/injectable.decorator"
import { PuppeteerService } from "./puppeteer.service"
import { DownloadResult, RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, UploadResult } from "src/model/robot.model"
import { FileSystemStoredFile } from "nestjs-form-data"
import { WsGateway } from "./ws.gateway"
import { RunLogService } from "./run-log.service"

const packageJson = require('../../package.json')
export const VERSION = packageJson.version

@Injectable()
export class RobotService {

  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly wsGateway: WsGateway,
    private readonly runLogService: RunLogService,
  ) { }

  async version(): Promise<string> {
    return VERSION
  }

  async create(pool: string | null): Promise<RobotCreateResp> {
    const response = await this.puppeteerService.createInstance(pool)
    this.wsGateway.send('updateList', {})
    return response
  }

  async error(dto: RobotErrorReq): Promise<RobotCommandResp> {
    return this.puppeteerService.runError(dto)
  }

  async run(dto: RobotCommandReq): Promise<RobotCommandResp> {
    return this.runLoggedOperation('run_command', dto, () => this.puppeteerService.runCommand(dto))
  }

  async navigate(robotId: string, url: string, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'navigate',
      { robotId, url, waitUntil, timeoutMs },
      () => this.puppeteerService.navigate(robotId, url, waitUntil, timeoutMs),
    )
  }

  async runJavascriptOnPage(robotId: string, script: string, args?: unknown, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'run_javascript_on_page',
      { robotId, script, args, timeoutMs },
      () => this.puppeteerService.runJavascriptOnPage(robotId, script, args, timeoutMs),
    )
  }

  async typeText(robotId: string, selector: string, text: string, clearBefore?: boolean, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'type',
      { robotId, selector, text, clearBefore, timeoutMs },
      () => this.puppeteerService.typeText(robotId, selector, text, clearBefore, timeoutMs),
    )
  }

  async setValue(robotId: string, selector: string, value: string, dispatchEvents?: string[], timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'set_value',
      { robotId, selector, value, dispatchEvents, timeoutMs },
      () => this.puppeteerService.setValue(robotId, selector, value, dispatchEvents, timeoutMs),
    )
  }

  async click(robotId: string, selector: string, waitForNavigation?: boolean, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'click',
      { robotId, selector, waitForNavigation, waitUntil, timeoutMs },
      () => this.puppeteerService.click(robotId, selector, waitForNavigation, waitUntil, timeoutMs),
    )
  }

  async waitForNavigation(robotId: string, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.puppeteerService.waitForNavigation(robotId, waitUntil, timeoutMs)
  }

  async getHtml(robotId: string): Promise<RobotCommandResp> {
    return this.puppeteerService.getHtml(robotId)
  }

  async getText(robotId: string, selector?: string): Promise<RobotCommandResp> {
    return this.puppeteerService.getText(robotId, selector)
  }

  async uploadFileToInput(robotId: string, selector: string, hash: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.puppeteerService.uploadFileToInput(robotId, selector, hash, timeoutMs)
  }

  async downloadUrl(robotId: string, url: string, fileName?: string): Promise<RobotCommandResp> {
    return this.puppeteerService.downloadUrl(robotId, url, fileName)
  }

  async pageInfo(robotId: string): Promise<RobotCommandResp> {
    return this.puppeteerService.pageInfo(robotId)
  }

  async inspectInteractiveElements(robotId: string, options?: {
    onlyVisible?: boolean
    includeIframes?: boolean
    maxIframeDepth?: number
    maxItems?: number
    maxTextLength?: number
  }): Promise<RobotCommandResp> {
    return this.puppeteerService.inspectInteractiveElements(robotId, options)
  }

  async delete(id: string): Promise<boolean> {
    const response = await this.puppeteerService.delete(id)
    this.wsGateway.send('updateList', {})
    return response
  }

  async upload(file: FileSystemStoredFile): Promise<UploadResult> {
    return this.puppeteerService.upload(file)
  }

  getDownloadedFile(fileId: string): { ok: boolean, filePath?: string, metadata?: DownloadResult, message?: string } {
    return this.puppeteerService.getDownloadedFile(fileId)
  }

  async screenshot(id: string): Promise<RobotCommandResp> {
    return this.puppeteerService.screenshot(id)
  }

  async list(): Promise<RobotInfo[]> {
    const info = await this.puppeteerService.list()  
    return info
  }

  async deleteFile(id: string): Promise<boolean> {
    return true
  }

  private async runLoggedOperation(
    operationName: string,
    request: unknown,
    operation: () => Promise<RobotCommandResp>,
  ): Promise<RobotCommandResp> {
    const requestedAt = new Date()

    try {
      const response = await operation()
      await this.runLogService.saveRunLog({
        operationName,
        requestedAt,
        durationMs: Date.now() - requestedAt.getTime(),
        request,
        response,
      })
      return response
    } catch (error) {
      await this.runLogService.saveRunLog({
        operationName,
        requestedAt,
        durationMs: Date.now() - requestedAt.getTime(),
        request,
        error,
      })
      throw error
    }
  }

}
