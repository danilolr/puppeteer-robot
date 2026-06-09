import { Injectable } from "@nestjs/common/decorators/core/injectable.decorator"
import { PuppeteerService } from "./puppeteer.service"
import { DownloadResult, RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, UploadResult } from "src/model/robot.model"
import { FileSystemStoredFile } from "nestjs-form-data"
import { WsGateway } from "./ws.gateway"

const packageJson = require('../../package.json')
export const VERSION = packageJson.version

@Injectable()
export class RobotService {

  constructor(private readonly puppeteerService: PuppeteerService, 
    private readonly wsGateway: WsGateway
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
    return this.puppeteerService.runCommand(dto)
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

}
