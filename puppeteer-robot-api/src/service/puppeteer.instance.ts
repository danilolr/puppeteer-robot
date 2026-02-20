import puppeteer, { Browser } from 'puppeteer-core'
import { RobotCommandResp, RobotErrorReq, RobotStatusEnum, RunStatusEnum } from 'src/model/robot.model'
const fs = require('fs')

export class PuppeteerInstance {
    private browser: Browser
    private status: RobotStatusEnum = RobotStatusEnum.IDLE

    public pool: string | null = null
    public createdAt: Date = new Date()
    public errorInfo: any

    constructor(public readonly insanceId: string, pool: string | null,) {
        this.pool = pool
    }

    async init() {
        const browser = await puppeteer.launch({
            channel: process.env.DEV_MODE === 'true' ? 'chrome' : undefined,
            executablePath: process.env.DEV_MODE === 'true' ? undefined : '/usr/bin/chromium-browser',
            headless: !(process.env.DEV_MODE === 'true'),
            defaultViewport: {
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
            },
            args: [
                '--no-sandbox',
                '--disable-extensions',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--disable-gpu'
            ]
        })
        this.browser = browser
        this.status = RobotStatusEnum.BUSY
    }

    async runCommand(command: string): Promise<any> {
        console.log("Running command on puppeteer instance: " + this.insanceId)
        console.log(command)
        try {
            const browser = await this.browser
            const pages = await browser.pages()
            const page = pages[pages.length - 1]
            const filePath = this.getFilePath
            var fnDef = `
async function exec() {
    ${command} 
} 
exec()`
            const r = await eval(fnDef)
            console.log("Command executed successfully:", JSON.stringify(r))
            return { ok: true, data: r }
        } catch (error) {
            console.error(error)
            return { ok: false, message: error.message, data: null }
        }
        console.log("--------------------------------")
    }

    getFilePath(hash: string): string {
        const fpm = `${process.env.TEMP_FILE_PATH}/upload/${hash}/metadata.json`
        if (!fs.existsSync(fpm)) {
            console.log("Metadata file not found: " + fpm)
            return ""
        }
        const fileContent = fs.readFileSync(fpm).toString()
        console.log("METADATA file content: " + fileContent)
        const metadata = JSON.parse(fileContent)
        const fp = `${process.env.TEMP_FILE_PATH}/upload/${hash}/${metadata.originalName}`
        if (!fs.existsSync(fp)) {
            console.log("File not found: " + fp)
            return ""
        }
        return fp
    }

    async handleError(dto: RobotErrorReq): Promise<RobotCommandResp> {
        this.errorInfo = dto
        this.status = RobotStatusEnum.ERROR
        return {
            status: RunStatusEnum.OK,
        }
    }

    getStatus() {
        return this.status
    }

    setIdle() {
        this.status = RobotStatusEnum.IDLE
    }

    setBusy() {
        this.status = RobotStatusEnum.BUSY
    }

    async close() {
        console.log("Closing puppeteer instance: " + this.insanceId)
        await this.browser.close()
    }

}