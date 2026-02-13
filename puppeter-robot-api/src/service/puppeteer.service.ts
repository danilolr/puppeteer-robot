import { RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, RobotStatusEnum, RunStatusEnum, UploadResult } from "src/model/robot.model"
import { PuppeteerInstance } from "./puppeter.instance"
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
    idleInstancesByPool = new Map<string, string[]>()

    async createInstance(pool: string | null): Promise<RobotCreateResp> {
        if (pool) {
            var idleInstancesIds = this.idleInstancesByPool.get(pool)
            if (!idleInstancesIds) {
                idleInstancesIds = []
                this.idleInstancesByPool.set(pool, idleInstancesIds)
            }
            for (const idleInstanceId of idleInstancesIds) {
                const instance = this.instances.get(idleInstanceId)
                if (instance && !instance.errorInfo) {
                    console.log(`Error instance ${idleInstanceId} from pool ${pool}`)
                } else {
                    const robotId = idleInstanceId
                    idleInstancesIds.splice(0, 1)
                    return { ok: true, robotId: robotId, isFromPool: true }
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
            instance.init()
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
            var idleInstancesIds = this.idleInstancesByPool.get(pool)
            if (!idleInstancesIds) {
                idleInstancesIds = []
                this.idleInstancesByPool.set(pool, idleInstancesIds)
            }
            if (idleInstancesIds.includes(robotId)) {
                await instance.close()
                this.instances.delete(robotId)
                idleInstancesIds = idleInstancesIds.filter(id => id !== robotId)
                this.idleInstancesByPool.set(pool, idleInstancesIds)
                return false
            } else {
                idleInstancesIds.push(robotId)
            }
        }
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
        return Array.from(this.instances.keys()).map(robotId => {
            const instance = this.instances.get(robotId)
            const isIdle = instance!.pool ? (this.idleInstancesByPool.get(instance!.pool!)?.includes(robotId) ?? false) : false
            return {
                robotId: robotId,
                pool: instance!.pool,
                createdAt: instance!.createdAt,
                status: instance!.errorInfo ? RobotStatusEnum.ERROR : (isIdle ? RobotStatusEnum.IDLE : RobotStatusEnum.BUSY),
                errorInfo: instance!.errorInfo
            } as RobotInfo
        })
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