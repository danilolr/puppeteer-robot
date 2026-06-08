import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { McpService } from './mcp.service'

@ApiExcludeController()
@Controller('puppeteer-robot/mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  async post(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handlePost(req, res)
  }

  @Get()
  async get(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleGet(req, res)
  }

  @Delete()
  async delete(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleDelete(req, res)
  }
}
