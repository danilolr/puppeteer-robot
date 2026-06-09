import puppeteer, { Browser, Page } from 'puppeteer-core'
import { RobotCommandResp, RobotErrorReq, RobotStatusEnum, RunStatusEnum } from 'src/model/robot.model'
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

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
            const downloadUrl = (url: string, options?: { fileName?: string }) => this.downloadUrl(url, options, page)
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

    async downloadUrl(url: string, options: { fileName?: string } | undefined, page: Page): Promise<any> {
        try {
            const sourceUrl = new URL(url)
            if (sourceUrl.protocol !== 'http:' && sourceUrl.protocol !== 'https:') {
                return { ok: false, message: `Unsupported download URL protocol: ${sourceUrl.protocol}` }
            }

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 60000)

            const cookies = await page.cookies(sourceUrl.toString())
            const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
            const userAgent = await page.evaluate(() => navigator.userAgent)

            let response: Awaited<ReturnType<typeof fetch>>
            try {
                response = await fetch(sourceUrl.toString(), {
                    headers: {
                        'User-Agent': userAgent,
                        'Referer': page.url(),
                        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
                    },
                    signal: controller.signal,
                })
            } finally {
                clearTimeout(timeout)
            }

            if (!response.ok) {
                return { ok: false, message: `Download failed: ${response.status} ${response.statusText}` }
            }

            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
            const fileName = this.resolveDownloadFileName(options?.fileName, response.headers.get('content-disposition'), sourceUrl, mimeType)
            const fileId = randomUUID()
            const dir = `${process.env.TEMP_FILE_PATH}/download/${fileId}`
            const fileDiskPath = `${dir}/${fileName}`

            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(fileDiskPath, buffer)

            const metadata = {
                ok: true,
                fileId,
                fileName,
                mimeType,
                size: buffer.length,
                sourceUrl: sourceUrl.toString(),
                downloadedAt: new Date().toISOString(),
                robotId: this.insanceId,
                downloadUrl: `/puppeteer-robot/file/download/${fileId}`,
            }
            fs.writeFileSync(`${dir}/metadata.json`, JSON.stringify(metadata))
            return metadata
        } catch (error) {
            return { ok: false, message: `Download failed: ${error.message}` }
        }
    }

    private resolveDownloadFileName(fileName: string | undefined, contentDisposition: string | null, sourceUrl: URL, mimeType: string): string {
        const fromDisposition = this.fileNameFromContentDisposition(contentDisposition)
        const fromUrl = path.basename(sourceUrl.pathname)
        const resolved = fileName || fromDisposition || fromUrl || 'download'
        const safeName = this.sanitizeFileName(resolved)
        if (!path.extname(safeName) && mimeType === 'application/pdf') {
            return `${safeName}.pdf`
        }
        return safeName
    }

    private fileNameFromContentDisposition(contentDisposition: string | null): string {
        if (!contentDisposition) {
            return ''
        }
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
        if (utf8Match?.[1]) {
            return decodeURIComponent(utf8Match[1].trim())
        }
        const match = contentDisposition.match(/filename="?([^";]+)"?/i)
        return match?.[1]?.trim() || ''
    }

    private sanitizeFileName(fileName: string): string {
        const sanitized = fileName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w.-]+/g, '_')
            .replace(/^_+|_+$/g, '')
        return sanitized || 'download'
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
