import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, APP_INITIALIZER, inject } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { provideRouter } from '@angular/router'

import { routes } from './app.routes'
import { ConfigService } from './service/config.service'

function initializeApp() {
  const configService = inject(ConfigService)
  return () => configService.loadConfig()
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true
    }
  ]
}

