import { Body, Controller, Delete, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common'
import { RobotService } from 'src/service/robot.service'
import { ApiBearerAuth, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DownloadResult, RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, UploadParams, UploadResult } from 'src/model/robot.model';
import { FormDataRequest } from 'nestjs-form-data';
import { AuthGuard } from 'src/service/auth.guard';
import { Response } from 'express';

@ApiBearerAuth()
@Controller('puppeteer-robot')
@UseGuards(AuthGuard)
export class RobotController {
  constructor(private readonly robotService: RobotService) {}

  @Get('/version')
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    type: String,
  })
  async version(): Promise<string> {
    return await this.robotService.version()
  }

  @Post('/create/:pool')
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    type: RobotCreateResp,
  })
  async create(@Param("pool") pool: string): Promise<RobotCreateResp> {
    return await this.robotService.create(pool=="none" || pool === "" ? null : pool)
  }

  @Put('/run')
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    type: RobotCommandResp,
  })
  async run(@Body() dto: RobotCommandReq): Promise<RobotCommandResp> {
    return await this.robotService.run(dto)
  }

  @Put('/error')
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    type: RobotCommandResp,
  })
  async error(@Body() dto: RobotErrorReq): Promise<RobotCommandResp> {
    return await this.robotService.error(dto)
  }

  @Get('/screenshot/:id')
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    type: RobotCommandResp,
  })
  async screenshot(@Param("id") id: string): Promise<RobotCommandResp> {
    return await this.robotService.screenshot(id)
  }

  @Get('/list')
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    type: [RobotInfo],
  })
  async list(): Promise<RobotInfo[]> {
    return await this.robotService.list()
  }

  @Delete('/delete/:id')
  @ApiTags('puppeteer-robot')
  async delete(@Param("id") id: string): Promise<boolean> {
    return await this.robotService.delete(id)
  }

  @Post("file/upload")
  @ApiTags('puppeteer-robot')
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  @ApiResponse({
    status: 200,
    description: 'Upload result',
    type: UploadResult,
  })
  async upload(@Body() params : UploadParams): Promise<UploadResult> {
    return this.robotService.upload(params.file)
  }

  @Get("file/download/:fileId")
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    description: 'Downloaded file',
    type: DownloadResult,
  })
  async downloadFile(@Param("fileId") fileId: string, @Res() res: Response): Promise<void> {
    const result = this.robotService.getDownloadedFile(fileId)
    if (!result.ok || !result.filePath || !result.metadata) {
      res.status(404).json({ ok: false, message: result.message || 'Downloaded file not found' })
      return
    }

    const fileName = result.metadata.fileName || 'download'
    res.setHeader('Content-Type', result.metadata.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.download(result.filePath, fileName)
  }

  @Delete("file/delete/:hash")
  @ApiTags('puppeteer-robot')
  @ApiResponse({
    status: 200,
    description: 'Upload result',
    type: UploadResult,
  })
  async deleteFile(@Param("hash") hash: string): Promise<boolean> {
    return this.robotService.deleteFile(hash)
  }

}
