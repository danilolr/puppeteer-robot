import { Injectable } from "@nestjs/common/decorators/core/injectable.decorator"
import { PuppeteerService } from "./puppeteer.service"
import { DownloadResult, RobotBackendEnum, RobotCommandReq, RobotCommandResp, RobotCreateReq, RobotCreateResp, RobotErrorReq, RobotInfo, RunStatusEnum, UploadResult } from "src/model/robot.model"
import { FileSystemStoredFile } from "nestjs-form-data"
import { WsGateway } from "./ws.gateway"
import { RunLogService } from "./run-log.service"
import { ChromeExtensionAutomationService } from "./chrome-extension-automation.service"

const packageJson = require('../../package.json')
export const VERSION = packageJson.version

@Injectable()
export class RobotService {

  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly wsGateway: WsGateway,
    private readonly runLogService: RunLogService,
    private readonly chromeExtensionAutomationService: ChromeExtensionAutomationService,
  ) { }

  async version(): Promise<string> {
    return VERSION
  }

  async create(pool: string | null, backend: RobotBackendEnum | string = RobotBackendEnum.PUPPETEER, instanceId?: string): Promise<RobotCreateResp> {
    if (backend === RobotBackendEnum.CHROME_EXTENSION) {
      const response = this.chromeExtensionAutomationService.create(pool, instanceId)
      this.wsGateway.send('updateList', {})
      return response
    }

    const response = await this.puppeteerService.createInstance(pool)
    if (response.ok) {
      response.backend = RobotBackendEnum.PUPPETEER
    }
    this.wsGateway.send('updateList', {})
    return response
  }

  async createFromRequest(dto: RobotCreateReq = {}): Promise<RobotCreateResp> {
    return this.create(
      this.normalizePool(dto.pool),
      dto.backend ?? RobotBackendEnum.PUPPETEER,
      dto.instanceId,
    )
  }

  async error(dto: RobotErrorReq): Promise<RobotCommandResp> {
    return this.puppeteerService.runError(dto)
  }

  async run(dto: RobotCommandReq): Promise<RobotCommandResp> {
    return this.runLoggedOperation('run_command', dto.robotId, dto, () => {
      if (this.isChromeExtensionRobot(dto.robotId)) {
        return this.chromeExtensionAutomationService.runCommand(dto)
      }
      return this.puppeteerService.runCommand(dto)
    })
  }

  async navigate(robotId: string, url: string, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'navigate',
      robotId,
      { robotId, url, waitUntil, timeoutMs },
      () => this.isChromeExtensionRobot(robotId)
        ? this.chromeExtensionAutomationService.navigate(robotId, url, waitUntil, timeoutMs)
        : this.puppeteerService.navigate(robotId, url, waitUntil, timeoutMs),
    )
  }

  async runJavascriptOnPage(robotId: string, script: string, args?: unknown, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'run_javascript_on_page',
      robotId,
      { robotId, script, args, timeoutMs },
      () => this.isChromeExtensionRobot(robotId)
        ? this.chromeExtensionAutomationService.runJavascriptOnPage(robotId, script, args, timeoutMs)
        : this.puppeteerService.runJavascriptOnPage(robotId, script, args, timeoutMs),
    )
  }

  async typeText(robotId: string, selector: string, text: string, clearBefore?: boolean, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'type',
      robotId,
      { robotId, selector, text, clearBefore, timeoutMs },
      () => this.isChromeExtensionRobot(robotId)
        ? this.chromeExtensionAutomationService.typeText(robotId, selector, text, clearBefore, timeoutMs)
        : this.puppeteerService.typeText(robotId, selector, text, clearBefore, timeoutMs),
    )
  }

  async setValue(robotId: string, selector: string, value: string, dispatchEvents?: string[], timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'set_value',
      robotId,
      { robotId, selector, value, dispatchEvents, timeoutMs },
      () => this.isChromeExtensionRobot(robotId)
        ? this.chromeExtensionAutomationService.setValue(robotId, selector, value, dispatchEvents, timeoutMs)
        : this.puppeteerService.setValue(robotId, selector, value, dispatchEvents, timeoutMs),
    )
  }

  async click(robotId: string, selector: string, waitForNavigation?: boolean, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.runLoggedOperation(
      'click',
      robotId,
      { robotId, selector, waitForNavigation, waitUntil, timeoutMs },
      () => this.isChromeExtensionRobot(robotId)
        ? this.chromeExtensionAutomationService.click(robotId, selector, waitForNavigation, waitUntil, timeoutMs)
        : this.puppeteerService.click(robotId, selector, waitForNavigation, waitUntil, timeoutMs),
    )
  }

  async waitForNavigation(robotId: string, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    if (this.isChromeExtensionRobot(robotId)) {
      return {
        status: RunStatusEnum.INTERNAL_ERROR,
        message: 'wait_for_navigation is not supported by ChromeExtensionBackend',
        data: null,
      }
    }
    return this.puppeteerService.waitForNavigation(robotId, waitUntil, timeoutMs)
  }

  async getHtml(robotId: string): Promise<RobotCommandResp> {
    if (this.isChromeExtensionRobot(robotId)) {
      return this.chromeExtensionAutomationService.getHtml(robotId)
    }
    return this.puppeteerService.getHtml(robotId)
  }

  async getText(robotId: string, selector?: string): Promise<RobotCommandResp> {
    if (this.isChromeExtensionRobot(robotId)) {
      return this.chromeExtensionAutomationService.getText(robotId, selector)
    }
    return this.puppeteerService.getText(robotId, selector)
  }

  async uploadFileToInput(robotId: string, selector: string, hash: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.puppeteerService.uploadFileToInput(robotId, selector, hash, timeoutMs)
  }

  async downloadUrl(robotId: string, url: string, fileName?: string): Promise<RobotCommandResp> {
    return this.puppeteerService.downloadUrl(robotId, url, fileName)
  }

  async pageInfo(robotId: string): Promise<RobotCommandResp> {
    if (this.isChromeExtensionRobot(robotId)) {
      return this.chromeExtensionAutomationService.pageInfo(robotId)
    }
    return this.puppeteerService.pageInfo(robotId)
  }

  async inspectInteractiveElements(robotId: string, options?: {
    onlyVisible?: boolean
    includeIframes?: boolean
    maxIframeDepth?: number
    maxItems?: number
    maxTextLength?: number
  }): Promise<RobotCommandResp> {
    if (this.isChromeExtensionRobot(robotId)) {
      return this.chromeExtensionAutomationService.inspectInteractiveElements(robotId, options)
    }
    return this.puppeteerService.inspectInteractiveElements(robotId, options)
  }

  async delete(id: string): Promise<boolean> {
    if (this.isChromeExtensionRobot(id)) {
      const response = this.chromeExtensionAutomationService.delete(id)
      this.wsGateway.send('updateList', {})
      return response
    }

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
    if (this.isChromeExtensionRobot(id)) {
      return {
        status: RunStatusEnum.INTERNAL_ERROR,
        message: 'Screenshots are not supported by ChromeExtensionBackend yet',
        data: null,
      }
    }
    return this.puppeteerService.screenshot(id)
  }

  async list(): Promise<RobotInfo[]> {
    const puppeteerInfo = await this.puppeteerService.list()
    const chromeExtensionInfo = this.chromeExtensionAutomationService.list()
    return [
      ...puppeteerInfo.map(info => ({ ...info, backend: RobotBackendEnum.PUPPETEER })),
      ...chromeExtensionInfo,
    ]
  }

  async deleteFile(id: string): Promise<boolean> {
    return true
  }

  private async runLoggedOperation(
    operationName: string,
    robotId: string,
    request: unknown,
    operation: () => Promise<RobotCommandResp>,
  ): Promise<RobotCommandResp> {
    const requestedAt = new Date()

    try {
      const response = await operation()
      await this.runLogService.saveRunLog({
        operationName,
        robotId,
        sessionId: this.getSessionId(robotId),
        requestedAt,
        durationMs: Date.now() - requestedAt.getTime(),
        request,
        response,
      })
      return response
    } catch (error) {
      await this.runLogService.saveRunLog({
        operationName,
        robotId,
        sessionId: this.getSessionId(robotId),
        requestedAt,
        durationMs: Date.now() - requestedAt.getTime(),
        request,
        error,
      })
      throw error
    }
  }

  private isChromeExtensionRobot(robotId: string): boolean {
    return this.chromeExtensionAutomationService.has(robotId)
  }

  private getSessionId(robotId: string): string | undefined {
    if (this.isChromeExtensionRobot(robotId)) {
      return this.chromeExtensionAutomationService.getSessionId(robotId)
    }
    return this.puppeteerService.getSessionId(robotId)
  }

  private normalizePool(pool?: string | null): string | null {
    return !pool || pool === 'none' ? null : pool
  }

}
