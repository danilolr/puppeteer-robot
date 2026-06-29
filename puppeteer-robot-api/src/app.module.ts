import { Module } from '@nestjs/common';
import { RobotService } from './service/robot.service'
import { RobotController } from './controller/robot.controller'
import { PuppeteerService } from './service/puppeteer.service'
import { NestjsFormDataModule } from 'nestjs-form-data'
import { WsGateway } from './service/ws.gateway'
import { McpController } from './mcp/mcp.controller'
import { McpService } from './mcp/mcp.service'
import { RunLogService } from './service/run-log.service'

@Module({
  imports: [NestjsFormDataModule],
  controllers: [RobotController, McpController],
  providers: [RobotService, PuppeteerService, WsGateway, McpService, RunLogService],
})
export class AppModule {}
