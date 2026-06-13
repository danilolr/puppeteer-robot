import puppeteer, { Browser, Page } from 'puppeteer-core'
import { RobotCommandResp, RobotErrorReq, RobotStatusEnum, RunStatusEnum } from 'src/model/robot.model'
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')

type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'

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

    async runJavascriptOnPage(script: string, args: unknown = {}, timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        const previousTimeout = page.getDefaultTimeout()
        page.setDefaultTimeout(timeoutMs)
        try {
            return await page.evaluate(
                async ({ script: scriptBody, args: scriptArgs }) => {
                    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
                    const fn = new AsyncFunction('args', scriptBody)
                    return await fn(scriptArgs)
                },
                { script, args },
            )
        } finally {
            page.setDefaultTimeout(previousTimeout)
        }
    }

    async navigate(url: string, waitUntil: WaitUntil = 'networkidle2', timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        await page.goto(url, { waitUntil, timeout: timeoutMs })
        return {
            ok: true,
            url: page.url(),
            title: await page.title(),
        }
    }

    async typeText(selector: string, text: string, clearBefore = false, timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        const element = await page.waitForSelector(selector, { timeout: timeoutMs })
        if (!element) {
            return { ok: false, message: `Selector not found: ${selector}` }
        }
        const isVisible = await element.isVisible()
        if (!isVisible) {
            return { ok: false, message: `Element is not visible and cannot be typed into: ${selector}` }
        }
        if (clearBefore) {
            await page.$eval(selector, (el: HTMLInputElement | HTMLTextAreaElement) => {
                el.value = ''
                el.dispatchEvent(new Event('input', { bubbles: true }))
                el.dispatchEvent(new Event('change', { bubbles: true }))
            })
        }
        await element.type(text)
        return { ok: true, selector }
    }

    async setValue(selector: string, value: string, dispatchEvents: string[] = ['input', 'change'], timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        await page.waitForSelector(selector, { visible: true, timeout: timeoutMs })
        return await page.$eval(
            selector,
            (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, args: { value: string, dispatchEvents: string[] }) => {
                el.value = args.value
                for (const eventName of args.dispatchEvents) {
                    el.dispatchEvent(new Event(eventName, { bubbles: true }))
                }
                return { ok: true }
            },
            { value, dispatchEvents },
        )
    }

    async click(selector: string, waitForNavigation = false, waitUntil: WaitUntil = 'networkidle2', timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        const element = await page.waitForSelector(selector, { visible: true, timeout: timeoutMs })
        if (!element) {
            return { ok: false, message: `Selector not found: ${selector}` }
        }

        await element.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }))
        if (waitForNavigation) {
            await Promise.all([
                page.waitForNavigation({ waitUntil, timeout: timeoutMs }),
                element.click(),
            ])
        } else {
            await element.click()
        }

        return {
            ok: true,
            selector,
            url: page.url(),
            title: await page.title(),
        }
    }

    async waitForNavigation(waitUntil: WaitUntil = 'networkidle2', timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        await page.waitForNavigation({ waitUntil, timeout: timeoutMs })
        return {
            ok: true,
            url: page.url(),
            title: await page.title(),
        }
    }

    async getHtml(): Promise<any> {
        const page = await this.getCurrentPage()
        return {
            ok: true,
            html: await page.content(),
            url: page.url(),
            title: await page.title(),
        }
    }

    async getText(selector?: string): Promise<any> {
        const page = await this.getCurrentPage()
        const text = await page.evaluate((selectorArg?: string) => {
            const element = selectorArg ? document.querySelector(selectorArg) : document.body
            if (!element) {
                return null
            }
            return (element as HTMLElement).innerText || element.textContent || ''
        }, selector)
        if (text === null) {
            return { ok: false, message: `Selector not found: ${selector}` }
        }
        return {
            ok: true,
            text,
            selector: selector || null,
            url: page.url(),
            title: await page.title(),
        }
    }

    async uploadFileToInput(selector: string, hash: string, timeoutMs = 30000): Promise<any> {
        const page = await this.getCurrentPage()
        const resolvedPath = this.getFilePath(hash)
        if (!resolvedPath) {
            return { ok: false, message: `Uploaded file not found for hash: ${hash}` }
        }

        const element = await page.waitForSelector(selector, { timeout: timeoutMs })
        if (!element) {
            return { ok: false, message: `Selector not found: ${selector}` }
        }

        await (element as any).uploadFile(resolvedPath)
        return {
            ok: true,
            selector,
            hash,
        }
    }

    async downloadUrlFromCurrentPage(url: string, fileName?: string): Promise<any> {
        const page = await this.getCurrentPage()
        const file = await this.downloadUrl(url, fileName ? { fileName } : undefined, page)
        return {
            ok: file.ok !== false,
            file,
        }
    }

    async pageInfo(): Promise<any> {
        const page = await this.getCurrentPage()
        const pages = await this.browser.pages()
        return {
            ok: true,
            url: page.url(),
            title: await page.title(),
            pages: pages.length,
        }
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

    private async getCurrentPage(): Promise<Page> {
        const pages = await this.browser.pages()
        if (pages.length === 0) {
            throw new Error('No active Puppeteer page found')
        }
        return pages[pages.length - 1]
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

            const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
            const fileName = this.resolveDownloadFileName(options?.fileName, response.headers.get('content-disposition'), sourceUrl, mimeType)
            const fileId = randomUUID()
            const dir = `${process.env.TEMP_FILE_PATH}/download/${fileId}`
            const fileDiskPath = `${dir}/${fileName}`

            fs.mkdirSync(dir, { recursive: true })
            if (response.body) {
                await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(fileDiskPath))
            } else {
                const arrayBuffer = await response.arrayBuffer()
                fs.writeFileSync(fileDiskPath, Buffer.from(arrayBuffer))
            }
            const size = fs.statSync(fileDiskPath).size

            const metadata = {
                ok: true,
                fileId,
                fileName,
                mimeType,
                size,
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
