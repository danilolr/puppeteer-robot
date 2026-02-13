import { Component, OnInit, signal } from '@angular/core'
import { ApisService } from '../../service/apis.service'
import { ConfigService } from '../../service/config.service'

@Component({
  selector: 'app-about-page',
  imports: [],
  templateUrl: './about-page.html',
  styleUrl: './about-page.css'
})
export class AboutPage implements OnInit {

  apiVersion = signal('')
  webAppVersion = signal('')
  apiUrl = signal('')
  envName = signal('')
  wsPath = signal('')
  
  constructor(private readonly apisService: ApisService, private readonly configService: ConfigService) {
    this.webAppVersion.set(configService.version)
    this.apiUrl.set(configService.apiUrl)
    this.envName.set(configService.envName)
    this.wsPath.set(configService.wsPath)
  }

  async ngOnInit() {
    const api = this.apisService.getPuppeteerRobotApi()
    const version = await api.robotControllerVersion()
    this.apiVersion.set(version)
  }

}
