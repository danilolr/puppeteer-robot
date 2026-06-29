import { DownloadResult, RobotCommandReq, RobotCommandResp, RobotCreateResp, RobotErrorReq, RobotInfo, RobotStatusEnum, RunStatusEnum, UploadResult } from "src/model/robot.model"
import { PuppeteerInstance } from "./puppeteer.instance"
import { Injectable } from '@nestjs/common'
import { FileSystemStoredFile } from "nestjs-form-data"
const { v4: uuidv4 } = require('uuid')
import * as cryptoJS from "crypto-js"
import { WsGateway } from "./ws.gateway"
const fs = require('fs')
const path = require('path')

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

    async navigate(robotId: string, url: string, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.navigate(url, waitUntil as any, timeoutMs))
    }

    async runJavascriptOnPage(robotId: string, script: string, args?: unknown, timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.runJavascriptOnPage(script, args, timeoutMs))
    }

    async typeText(robotId: string, selector: string, text: string, clearBefore?: boolean, timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.typeText(selector, text, clearBefore, timeoutMs))
    }

    async setValue(robotId: string, selector: string, value: string, dispatchEvents?: string[], timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.setValue(selector, value, dispatchEvents, timeoutMs))
    }

    async click(robotId: string, selector: string, waitForNavigation?: boolean, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.click(selector, waitForNavigation, waitUntil as any, timeoutMs))
    }

    async waitForNavigation(robotId: string, waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.waitForNavigation(waitUntil as any, timeoutMs))
    }

    async getHtml(robotId: string): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.getHtml())
    }

    async getText(robotId: string, selector?: string): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.getText(selector))
    }

    async uploadFileToInput(robotId: string, selector: string, hash: string, timeoutMs?: number): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.uploadFileToInput(selector, hash, timeoutMs))
    }

    async downloadUrl(robotId: string, url: string, fileName?: string): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.downloadUrlFromCurrentPage(url, fileName))
    }

    async pageInfo(robotId: string): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.pageInfo())
    }

    async inspectInteractiveElements(robotId: string, options?: {
        onlyVisible?: boolean
        includeIframes?: boolean
        maxIframeDepth?: number
        maxItems?: number
        maxTextLength?: number
    }): Promise<RobotCommandResp> {
        return this.runInstanceOperation(robotId, instance => instance.inspectInteractiveElements(options))
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

    private async runInstanceOperation(robotId: string, operation: (instance: PuppeteerInstance) => Promise<any>): Promise<RobotCommandResp> {
        const instance = this.instances.get(robotId)
        if (!instance) {
            return {
                status: RunStatusEnum.ROBOT_NOT_FOUND,
                message: 'Instance not found ' + robotId,
                data: null
            }
        }

        try {
            const data = await operation(instance)
            if (data && typeof data === 'object' && data.ok === false) {
                return {
                    status: RunStatusEnum.FUNCTION_RETURN_ERROR,
                    message: data.message,
                    data,
                }
            }
            return {
                status: RunStatusEnum.OK,
                data,
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
                message: result.message
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

    getSessionId(robotId: string): string | undefined {
        const instance = this.instances.get(robotId)
        return instance?.createdAt.toISOString()
    }

    async upload(file: FileSystemStoredFile): Promise<UploadResult> {
        const originalName = Buffer.from(file.originalName, 'latin1').toString('utf8')
        const fileName = this.sanitizeFileName(path.basename(originalName))
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

    private sanitizeFileName(fileName: string): string {
        const sanitized = fileName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w.-]+/g, '_')
            .replace(/^_+|_+$/g, '')
        return sanitized || 'upload'
    }

    getDownloadedFile(fileId: string): { ok: boolean, filePath?: string, metadata?: DownloadResult, message?: string } {
        if (!/^[a-zA-Z0-9-]+$/.test(fileId)) {
            return { ok: false, message: 'Invalid file ID' }
        }

        const dir = `${process.env.TEMP_FILE_PATH}/download/${fileId}`
        const metadataPath = `${dir}/metadata.json`
        if (!fs.existsSync(metadataPath)) {
            return { ok: false, message: 'Downloaded file not found' }
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath).toString()) as DownloadResult
        const safeFileName = metadata.fileName ? path.basename(metadata.fileName) : ''
        if (!safeFileName || safeFileName !== metadata.fileName) {
            return { ok: false, message: 'Invalid downloaded file metadata' }
        }

        const filePath = path.join(dir, safeFileName)
        if (!fs.existsSync(filePath)) {
            return { ok: false, message: 'Downloaded file content not found' }
        }

        return { ok: true, filePath, metadata }
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
                message: result.message
            }
        }
    }
}
