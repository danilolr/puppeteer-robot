import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder } from '@nestjs/swagger/dist/document-builder'
import { SwaggerModule } from '@nestjs/swagger'
import { VERSION } from './service/robot.service'
import * as express from 'express'
import { AuthGuard } from './service/auth.guard'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(express.json({ limit: '50mb' }))
  app.enableCors()
  app.useGlobalGuards(new AuthGuard())
  const config = new DocumentBuilder()
    .setTitle('Puppeteer Robot API')
    .setDescription('Puppeteer Robot API')
    .setVersion(VERSION)
    .addBearerAuth()
    .build()
  const documentFactory = () => SwaggerModule.createDocument(app, config, { autoTagControllers: false })
  SwaggerModule.setup('puppeteer-robot/api/v1/swagger', app, documentFactory)
  const port = process.env.PORT || 3000
  console.log(`Listening at http://localhost:${port}/puppeteer-robot/api/v1/swagger`)
  await app.listen(port)
}
if (!process.env.TEMP_FILE_PATH) {
  require('dotenv').config()
}
bootstrap()
