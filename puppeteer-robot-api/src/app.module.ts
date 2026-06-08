import { Module } from '@nestjs/common';
import { RobotService } from './service/robot.service'
import { RobotController } from './controller/robot.controller'
import { PuppeteerService } from './service/puppeteer.service'
import { NestjsFormDataModule } from 'nestjs-form-data'
import { OllamaService } from './service/ia/ollama.service'
import { WsGateway } from './service/ws.gateway'
import { GeminiService } from './service/ia/gemmini.service'
import { IaService } from './service/ia/ia.service'
import { GroqService } from './service/ia/groq.service'
import { McpController } from './mcp/mcp.controller'
import { McpService } from './mcp/mcp.service'

@Module({
  imports: [NestjsFormDataModule],
  controllers: [RobotController, McpController],
  providers: [RobotService, PuppeteerService, WsGateway, OllamaService, GeminiService, GroqService, IaService, McpService],
})
export class AppModule {}
