import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { RobotService } from 'src/service/robot.service'
import { ApiBearerAuth, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IaModelsResp, IaReq, IaResp, RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, UploadParams, UploadResult } from 'src/model/robot.model';
import { FormDataRequest } from 'nestjs-form-data';
import { AuthGuard } from 'src/service/auth.guard';

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

  @Put('/ia/run')
  @ApiTags('ia')
  @ApiResponse({
    status: 200,
    type: IaResp,
  })
  async runIa(@Body() dto: IaReq): Promise<IaResp> {
    return this.robotService.runIa(dto)
  }

  @Get('/ia/models')
  @ApiTags('ia')
  @ApiResponse({
    status: 200,
    type: IaModelsResp,
  })
  async iaModels(): Promise<IaModelsResp> {
    return this.robotService.getIaModels()
  }

}
