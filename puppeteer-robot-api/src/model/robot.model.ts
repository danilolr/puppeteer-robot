import { ApiProperty } from "@nestjs/swagger"
import { FileSystemStoredFile, IsFile, MaxFileSize } from "nestjs-form-data"

export enum RobotBackendEnum {
    PUPPETEER = "puppeteer",
    CHROME_EXTENSION = "chrome-extension",
}

export class RobotCreateReq {

    @ApiProperty({ enum: RobotBackendEnum, required: false, default: RobotBackendEnum.PUPPETEER })
    backend?: RobotBackendEnum

    @ApiProperty({ required: false })
    pool?: string

    @ApiProperty({ required: false, description: "Specific Chrome extension instance id to reserve." })
    instanceId?: string

}

export class RobotCommandReq {

    @ApiProperty()
    robotId: string

    @ApiProperty({example: "await page.goto('https://google.com')"})
    command: string
    
}

export class RobotErrorPayloadReq {

    @ApiProperty()
    errorCode: string

    @ApiProperty()
    message: string

    @ApiProperty()
    description: string

}

export class RobotErrorReq {

    @ApiProperty()
    robotId: string

    @ApiProperty({type: RobotErrorPayloadReq})
    payload: RobotErrorPayloadReq
    
}

export enum RunStatusEnum {
    OK = "OK",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    ROBOT_NOT_FOUND = "ROBOT_NOT_FOUND",
    JAVASCRIPT_EXCEPTION_ERROR = "JAVASCRIPT_EXCEPTION_ERROR",
    FUNCTION_RETURN_ERROR = "FUNCTION_RETURN_ERROR",
}

export class RobotCommandResp {

    @ApiProperty({ enum: RunStatusEnum })
    status : RunStatusEnum

    @ApiProperty({ required: false })
    message?: string

    @ApiProperty({ required: false })
    data?: any

}

export class RobotCreateResp {

    @ApiProperty()
    ok : boolean

    @ApiProperty({ required: false })
    message?: string

    @ApiProperty({ required: false })
    errorCode?: string

    @ApiProperty({ required: false })
    robotId?: string

    @ApiProperty({ enum: RobotBackendEnum, required: false })
    backend?: RobotBackendEnum | string

    @ApiProperty({ required: false })
    isFromPool?: boolean

}

export class UploadParams {

    @IsFile()
    @MaxFileSize(1e7)
    @ApiProperty({
        description: "File to upload",
        type: "string",
        format: "binary"
    })
    file: FileSystemStoredFile

}

export class UploadResult {

    @ApiProperty()
    ok : boolean

    @ApiProperty({ required: false })
    message?: string

    @ApiProperty({ required: false })
    hash?: string

}

export class DownloadResult {

    @ApiProperty()
    ok : boolean

    @ApiProperty({ required: false })
    message?: string

    @ApiProperty({ required: false })
    fileId?: string

    @ApiProperty({ required: false })
    fileName?: string

    @ApiProperty({ required: false })
    mimeType?: string

    @ApiProperty({ required: false })
    size?: number

    @ApiProperty({ required: false })
    sourceUrl?: string

    @ApiProperty({ required: false })
    downloadUrl?: string

}

export enum RobotStatusEnum {
    IDLE = "IDLE",
    BUSY = "BUSY",
    ERROR = "ERROR",
    DISCONNECTED = "DISCONNECTED",
}

export class BrowserTabInfo {

    @ApiProperty({ required: false })
    id?: number

    @ApiProperty({ required: false })
    url?: string

    @ApiProperty({ required: false })
    title?: string

    @ApiProperty({ required: false })
    active?: boolean

    @ApiProperty({ required: false })
    windowId?: number

}

export class RobotInfo {

    @ApiProperty()
    robotId: string

    @ApiProperty({ enum: RobotBackendEnum, required: false })
    backend?: RobotBackendEnum | string

    @ApiProperty()
    pool?: string

    @ApiProperty()
    isIdleOnPool: boolean

    @ApiProperty()
    createdAt: Date

    @ApiProperty({ enum: RobotStatusEnum })
    status: RobotStatusEnum

    @ApiProperty({required: false})
    errorInfo?: any

    @ApiProperty({ required: false, type: BrowserTabInfo })
    currentTab?: BrowserTabInfo

    @ApiProperty({ required: false, type: [BrowserTabInfo] })
    tabs?: BrowserTabInfo[]

}
