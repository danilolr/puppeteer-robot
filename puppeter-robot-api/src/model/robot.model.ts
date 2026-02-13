import { ApiProperty } from "@nestjs/swagger"
import { FileSystemStoredFile, IsFile, MaxFileSize } from "nestjs-form-data"

export class RobotCommandReq {

    @ApiProperty()
    robotId: string

    @ApiProperty({example: "await page.goto('https://google.com')"})
    command: string
    
}

export class RobotErrorPayloadReq {

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

    @ApiProperty()
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

export class IaReq {

    @ApiProperty()
    robotId: string

    @ApiProperty()
    query: string

    @ApiProperty()
    model: string
    
}

export class IaModelsResp {

    @ApiProperty()
    ok : boolean

    @ApiProperty({ required: false, isArray: true, type: String })
    models?: string[]

}

export class IaResp {

    @ApiProperty()
    ok : boolean

    @ApiProperty({ required: false })
    message?: string

    @ApiProperty({ required: false })
    html?: string

    @ApiProperty({ required: false })
    response?: string

    @ApiProperty({ required: false })
    prompt?: string

}

export enum RobotStatusEnum {
    IDLE = "IDLE",
    BUSY = "BUSY",
    ERROR = "ERROR"
}

export class RobotInfo {

    @ApiProperty()
    robotId: string

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

}