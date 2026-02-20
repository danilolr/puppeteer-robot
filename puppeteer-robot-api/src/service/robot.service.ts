import { Injectable } from "@nestjs/common/decorators/core/injectable.decorator"
import { PuppeteerService } from "./puppeteer.service"
import { IaModelsResp, IaReq, IaResp, RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, RunStatusEnum, UploadResult } from "src/model/robot.model"
import { FileSystemStoredFile } from "nestjs-form-data"
import { WsGateway } from "./ws.gateway"
import { IaService } from "./ia/ia.service"
const fs = require('fs')

const packageJson = require('../../package.json')
export const VERSION = packageJson.version

@Injectable()
export class RobotService {

  constructor(private readonly puppeteerService: PuppeteerService, 
    private readonly wsGateway: WsGateway, private readonly iaService: IaService
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

  async runIa(dto: IaReq): Promise<IaResp> {
    const html = await this.puppeteerService.getPageContent(dto.robotId)
    if (!html.status || html.status !== RunStatusEnum.OK) {
      return { ok: false, response: "Erro ao obter conteúdo da página: " + html.message }
    }    
    const prompt = `Responda a pergunta de forma clara e objetiva.
Baseado no HTML da pagina forncecida no final desta mensagem responda a seguinte questão :

"${dto.query}"

O conteúdo da página está em HTML, utilize-o para responder a pergunta :
${html.data}`
    console.log("Prompt para IA:", prompt)
    var t = new Date().getTime()
    const response = await this.iaService.run(prompt, dto.model)
    console.log("Tempo de resposta da IA:", new Date().getTime() - t, "ms")
    return { ok: true, response: response, html: html.data, prompt: prompt}
  }

  async getIaModels(): Promise<IaModelsResp> {
    var models: string[] = await this.iaService.getAvailableModels()
    return { ok: true, models: models }
  }

}