import { HttpClient } from "@angular/common/http"
import { Injectable } from "@angular/core"
import { lastValueFrom } from "rxjs"

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: any = {}

  constructor(private http: HttpClient) { }

  loadConfig() {
    return lastValueFrom(this.http.get('/assets/config.json'))
      .then(data => this.config = data)
  }

  get apiUrl() {
    return this.config.apiUrl
  }

  get wsPath() {
    return this.config.wsPath
  }

  get envName() {
    return this.config.envName
  }

  get apiToken() {
    return this.config.apiToken
  }

}