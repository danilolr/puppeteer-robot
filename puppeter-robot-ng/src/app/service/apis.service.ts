import { Injectable } from "@angular/core"

import { Configuration, IaApi, PuppeteerRobotApi } from "../api/puppeteer-robot-api"
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

  getIaApi(): IaApi {
    const api = new IaApi(this.getConfig())
    return api
  }

}