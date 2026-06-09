import { Injectable } from "@angular/core"

import { Configuration, PuppeteerRobotApi, RobotCommandResp } from "../api/puppeteer-robot-api"
import { ConfigService } from "./config.service"

@Injectable({
  providedIn: 'root'
})
export class ApisService {

  constructor(private readonly configService: ConfigService) { }

  getConfig(): Configuration {
    return new Configuration({ basePath: this.configService.apiUrl, headers: { 'Authorization': `Bearer ${this.configService.apiToken}` } })
  }

  getPuppeteerRobotApi(): PuppeteerRobotApi {
    const api = new PuppeteerRobotApi(this.getConfig())
    return api
  }

  async reportRobotError(robotId: string, errorCode: string, message: string, details: string): Promise<RobotCommandResp> {
    return await this.getPuppeteerRobotApi().robotControllerError({
      robotErrorReq: {
        robotId,
        payload: {
          errorCode,
          message,
          description: JSON.stringify({
            robotId,
            errorCode,
            message,
            details,
            reportedAt: new Date().toISOString(),
          }),
        },
      },
    })
  }

}
