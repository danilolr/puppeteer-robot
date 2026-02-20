import { RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, RobotStatusEnum, RunStatusEnum, UploadResult } from "src/model/robot.model"
import { PuppeteerInstance } from "./puppeteer.instance"
import { Injectable } from '@nestjs/common'
import { FileSystemStoredFile } from "nestjs-form-data"
const { v4: uuidv4 } = require('uuid')
import * as cryptoJS from "crypto-js"
import { WsGateway } from "./ws.gateway"
const fs = require('fs')

@Injectable()
export class PuppeteerService {

    constructor(private readonly wsGateway: WsGateway) {}

    instances = new Map<string, PuppeteerInstance>()

    async createInstance(pool: string | null): Promise<RobotCreateResp> {
        console.log(`Creating instance for pool ${pool}`)
        if (pool) {
            for (const robot of await this.list()) {
                if (robot.pool === pool && robot.status === RobotStatusEnum.IDLE) {
                    console.log(`Idle instance found for pool ${pool}: ${robot.robotId}`)
                    const instance = this.instances.get(robot.robotId)
                    instance!.setBusy()
                    return { ok: true, robotId: robot.robotId, isFromPool: true }
                }
            }
            const instance = await this.createNewInstance(false, pool)
            return instance
        } else {
            return this.createNewInstance(false, null)
        }
    }

    async createNewInstance(isFromPool: boolean, poolName: string | null): Promise<RobotCreateResp> {
        try {
            const uuid = uuidv4()
            const instance = new PuppeteerInstance(uuid, poolName)
            await instance.init()
            this.instances.set(uuid, instance)
            console.log("Created puppeteer instance: " + uuid)
            return { ok: true, robotId: uuid, isFromPool: isFromPool }
        } catch (error) {
            console.error(error)
            return { ok: false, message: error.message }
        }
    }

    runError(dto: RobotErrorReq): RobotCommandResp | PromiseLike<RobotCommandResp> {
        console.log(`Error reported for robot ID: ${dto.robotId}`)
        try {
            const desc = JSON.parse(dto.payload.description)
            const id = desc.robotId
            var instance = this.instances.get(id)
            console.log(this.instances)
            if (!instance) {
                return {
                    status: RunStatusEnum.ROBOT_NOT_FOUND,
                    message: 'Instance not found ' + dto.robotId,
                    data: null
                }
            }
            this.wsGateway.send('updateList', {})
            return instance.handleError(dto)
        } catch (error) {
            console.error(error)
            return {
                status: RunStatusEnum.INTERNAL_ERROR,
                message: error.message,
                data: null
            }
        }
    }

    async runCommand(dto: RobotCommandReq): Promise<RobotCommandResp> {
        const instance = this.instances.get(dto.robotId)
        if (!instance) {
            return {
                status: RunStatusEnum.ROBOT_NOT_FOUND,
                message: 'Instance not found ' + dto.robotId,
                data: null
            }
        }
        try {
            const result = await instance.runCommand(dto.command)
            if (result.ok) {
                if (result.data && typeof result.data === 'object' && result.data.ok === false) {
                    return {
                        status: RunStatusEnum.FUNCTION_RETURN_ERROR,
                        data: result.data,
                        message: result.data.message
                    }
                } else {
                    return {
                        status: RunStatusEnum.OK,
                        data: result.data
                    }
                }
            } else {
                return {
                    status: RunStatusEnum.JAVASCRIPT_EXCEPTION_ERROR,
                    message: result.message,
                    data: null
                }
            }
        } catch (error) {
            console.error(error)
            return {
                status: RunStatusEnum.INTERNAL_ERROR,
                message: error.message,
                data: null
            }
        }
    }

    async delete(robotId: string): Promise<boolean> {
        const instance = this.instances.get(robotId)
        const pool = instance?.pool
        if (!instance) {
            return false
        }
        if (!pool) {
            await instance.close()
            this.instances.delete(robotId)
        } else {            
            for (const robot of await this.list()) {
                if (robot.robotId === robotId && robot.pool === pool) {
                    if (robot.status === RobotStatusEnum.IDLE || robot.status === RobotStatusEnum.ERROR) {
            await instance.close()
            this.instances.delete(robotId)
                    return true
                    } else {
                        instance.setIdle()
                        return true
                    }
                }
            }
        }
        this.wsGateway.send('updateList', {})
        return true
    }

    async screenshot(robotId: string): Promise<RobotCommandResp> {
        const instance = this.instances.get(robotId)
        if (!instance) {
            return {
                status: RunStatusEnum.ROBOT_NOT_FOUND,
                message: 'Instance not found ' + robotId,
                data: null
            }
        }
        const command = `
            await new Promise(r => setTimeout(r, 2000));
            const screenshotBuffer = await page.screenshot({ encoding: 'base64', fullPage: true });
            return screenshotBuffer;
        `
        const result = await instance.runCommand(command)
        console.log(result)
        if (result.ok) {
            return {
                status: RunStatusEnum.OK,
                data: result.data
            }
        } else {
            return {
                status: RunStatusEnum.INTERNAL_ERROR,
                data: result.data,
                message: result.data.message
            }
        }
        return result
    }

    async list(): Promise<RobotInfo[]> {
        var infos : RobotInfo[] = []
        for (const instance of this.instances.values()) {
            var status = instance.getStatus()
            infos.push({
                robotId: instance.insanceId,
                pool: instance.pool,
                createdAt: instance.createdAt,
                status: status,
                errorInfo: instance.errorInfo
            } as RobotInfo)
        }
        return infos
    }

    async upload(file: FileSystemStoredFile): Promise<UploadResult> {
        const fileName = Buffer.from(file.originalName, 'latin1').toString('utf8')
        const buffer = file['buffer']
        const hash = cryptoJS.SHA1(cryptoJS.lib.WordArray.create(buffer)).toString()
        fs.mkdirSync(`${process.env.TEMP_FILE_PATH}/upload/${hash}`, { recursive: true })
        fs.writeFileSync(`${process.env.TEMP_FILE_PATH}/upload/${hash}/${fileName}`, buffer)
        fs.writeFileSync(`${process.env.TEMP_FILE_PATH}/upload/${hash}/metadata.json`, JSON.stringify({
            originalName: fileName,
            mimeType: file.mimetype,
            size: file.size
        }))
        return { ok: true, hash: hash }
    }

    async getPageContent(robotId: string): Promise<RobotCommandResp> {
        const instance = this.instances.get(robotId)
        if (!instance) {
            return {
                status: RunStatusEnum.ROBOT_NOT_FOUND,
                message: 'Instance not found ' + robotId,
                data: null
            }
        }
        const command = `const htmlContent = await page.content(); return htmlContent;`
        const result = await instance.runCommand(command)
        if (result.ok) {
            return {
                status: RunStatusEnum.OK,
                data: result.data
            }
        } else {
            return {
                status: RunStatusEnum.INTERNAL_ERROR,
                data: result.data,
                message: result.data.message
            }
        }
    }
}