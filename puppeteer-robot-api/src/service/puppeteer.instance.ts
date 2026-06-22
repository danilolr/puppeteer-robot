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
        const html = await page.content()
        console.log("Page HTML content length: " + html.length)
        return {
            ok: true,
            html: html,
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
        console.log("Page text content length: " + text.length)
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

    async inspectInteractiveElements(options: {
        onlyVisible?: boolean
        includeIframes?: boolean
        maxIframeDepth?: number
        maxItems?: number
        maxTextLength?: number
    } = {}): Promise<any> {
        const page = await this.getCurrentPage()
        const onlyVisible = options.onlyVisible ?? true
        const includeIframes = options.includeIframes ?? true
        const maxIframeDepth = options.maxIframeDepth ?? 2
        const maxItems = options.maxItems ?? 50
        const maxTextLength = options.maxTextLength ?? 120
        const frames = page.frames()
        const mainFrame = page.mainFrame()
        const framePathByFrame = new Map<any, number[]>()
        const frameSelectorByFrame = new Map<any, string | null>()
        framePathByFrame.set(mainFrame, [])
        frameSelectorByFrame.set(mainFrame, null)

        const childIndexes = new Map<any, number>()
        for (const frame of frames) {
            if (frame === mainFrame) continue
            const parent = frame.parentFrame()
            if (!parent) continue
            const index = childIndexes.get(parent) ?? 0
            childIndexes.set(parent, index + 1)
            const parentPath = framePathByFrame.get(parent) ?? []
            framePathByFrame.set(frame, [...parentPath, index])
        }

        for (const frame of frames) {
            if (frame === mainFrame) continue
            const parent = frame.parentFrame()
            const path = framePathByFrame.get(frame)
            if (!parent || !path) {
                frameSelectorByFrame.set(frame, null)
                continue
            }
            try {
                const selector = await parent.evaluate((childIndex) => {
                    const cssEscape = (value: string) => {
                        const css = (window as any).CSS
                        if (css?.escape) return css.escape(value)
                        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
                    }
                    const usefulClasses = (el: Element) => Array.from(el.classList || [])
                        .filter(cls => cls && !/\d{4,}|[A-Fa-f0-9]{8,}|^ng-|^css-|^sc-/.test(cls))
                        .slice(0, 2)
                    const iframe = Array.from(document.querySelectorAll('iframe'))[childIndex]
                    if (!iframe) return null
                    if (iframe.id) return `iframe#${cssEscape(iframe.id)}`
                    const name = iframe.getAttribute('name')
                    if (name) return `iframe[name="${cssEscape(name)}"]`
                    const src = iframe.getAttribute('src')
                    if (src) return `iframe[src="${cssEscape(src)}"]`
                    const classes = usefulClasses(iframe)
                    if (classes.length > 0) return `iframe.${classes.map(cssEscape).join('.')}`
                    return `iframe:nth-of-type(${childIndex + 1})`
                }, path[path.length - 1])
                frameSelectorByFrame.set(frame, selector)
            } catch (error) {
                frameSelectorByFrame.set(frame, null)
            }
        }

        const frameEntries: any[] = []
        const aggregate = {
            forms: [] as any[],
            inputs: [] as any[],
            textareas: [] as any[],
            selects: [] as any[],
            buttons: [] as any[],
            links: [] as any[],
            labels: [] as any[],
            duplicateIds: [] as any[],
        }
        const truncatedCategories = new Set<string>()

        const framesToInspect = frames.filter(frame => {
            const framePath = framePathByFrame.get(frame)
            if (!framePath) return false
            if (frame !== mainFrame && !includeIframes) return false
            return framePath.length <= maxIframeDepth
        })

        for (let frameIndex = 0; frameIndex < framesToInspect.length; frameIndex++) {
            const frame = framesToInspect[frameIndex]
            const framePath = framePathByFrame.get(frame) ?? []
            frameEntries.push({
                frameIndex,
                framePath,
                url: frame.url(),
                name: frame.name(),
                selectorHint: frameSelectorByFrame.get(frame) ?? null,
                parentFramePath: frame.parentFrame() ? (framePathByFrame.get(frame.parentFrame()) ?? null) : null,
            })

            let inspected: any
            try {
                inspected = await frame.evaluate(
                    ({ onlyVisible, maxTextLength }) => {
                        const normalizeText = (value: unknown): string => String(value ?? '')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, maxTextLength)
                        const cssEscape = (value: string) => {
                            const css = (window as any).CSS
                            if (css?.escape) return css.escape(value)
                            return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
                        }
                        const attrSelector = (name: string, value: string) => `[${name}="${cssEscape(value)}"]`
                        const isVisible = (el: Element): boolean => {
                            const element = el as HTMLElement
                            const rect = element.getBoundingClientRect()
                            if (rect.width <= 0 || rect.height <= 0) return false
                            let current: Element | null = el
                            while (current) {
                                const style = window.getComputedStyle(current)
                                if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                                    return false
                                }
                                current = current.parentElement
                            }
                            return true
                        }
                        const boundingBox = (el: Element) => {
                            const rect = (el as HTMLElement).getBoundingClientRect()
                            return {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                            }
                        }
                        const usefulClasses = (el: Element) => Array.from((el as HTMLElement).classList || [])
                            .filter(cls => cls && !/\d{4,}|[A-Fa-f0-9]{8,}|^ng-|^css-|^sc-/.test(cls))
                            .slice(0, 2)
                        const nthOfType = (el: Element): string => {
                            const parent = el.parentElement
                            if (!parent) return `${el.tagName.toLowerCase()}:nth-of-type(1)`
                            const sameTag = Array.from(parent.children).filter(child => child.tagName === el.tagName)
                            return `${el.tagName.toLowerCase()}:nth-of-type(${sameTag.indexOf(el) + 1})`
                        }
                        const selectorFor = (el: Element, duplicateIds: Set<string>): string => {
                            const tag = el.tagName.toLowerCase()
                            const form = (el as HTMLInputElement).form
                            const formPrefix = form ? selectorForForm(form, duplicateIds) : ''
                            const id = (el as HTMLElement).id
                            const name = el.getAttribute('name')
                            const type = el.getAttribute('type')
                            const ariaLabel = el.getAttribute('aria-label')
                            const placeholder = el.getAttribute('placeholder')
                            const classes = usefulClasses(el)
                            let base = ''
                            if (id && !duplicateIds.has(id)) base = `${tag}#${cssEscape(id)}`
                            else if (name && type) base = `${tag}${attrSelector('type', type)}${attrSelector('name', name)}`
                            else if (name) base = `${tag}${attrSelector('name', name)}`
                            else if (ariaLabel) base = `${tag}${attrSelector('aria-label', ariaLabel)}`
                            else if (placeholder) base = `${tag}${attrSelector('placeholder', placeholder)}`
                            else if (classes.length > 0) base = `${tag}.${classes.map(cssEscape).join('.')}${type ? attrSelector('type', type) : ''}`
                            else base = nthOfType(el)
                            return formPrefix && !base.startsWith('form') ? `${formPrefix} ${base}` : base
                        }
                        const selectorForForm = (form: HTMLFormElement, duplicateIds: Set<string>): string => {
                            const id = form.id
                            const name = form.getAttribute('name')
                            const classes = usefulClasses(form)
                            if (id && !duplicateIds.has(id)) return `form#${cssEscape(id)}`
                            if (name) return `form${attrSelector('name', name)}`
                            if (classes.length > 0) return `form.${classes.map(cssEscape).join('.')}`
                            return `form:nth-of-type(${Array.from(document.querySelectorAll('form')).indexOf(form) + 1})`
                        }
                        const labelFor = (el: Element): string => {
                            const id = (el as HTMLElement).id
                            if (id) {
                                const explicit = document.querySelector(`label[for="${cssEscape(id)}"]`)
                                if (explicit) return normalizeText(explicit.textContent)
                            }
                            const wrapping = el.closest('label')
                            if (wrapping) return normalizeText(wrapping.textContent)
                            return ''
                        }
                        const nearbyText = (el: Element): string => normalizeText(
                            labelFor(el) ||
                            el.getAttribute('aria-label') ||
                            el.getAttribute('placeholder') ||
                            el.textContent ||
                            el.parentElement?.textContent ||
                            ''
                        )
                        const ids = Array.from(document.querySelectorAll('[id]')).map(el => (el as HTMLElement).id).filter(Boolean)
                        const duplicateIdValues = new Set(ids.filter((id, index) => ids.indexOf(id) !== index))
                        const idCounts = ids.reduce((acc, id) => {
                            acc[id] = (acc[id] || 0) + 1
                            return acc
                        }, {} as Record<string, number>)
                        const duplicateIds = Object.entries(idCounts)
                            .filter(([, count]) => count > 1)
                            .map(([id, count]) => ({
                                id,
                                count,
                                visibleCount: Array.from(document.querySelectorAll(`#${cssEscape(id)}`)).filter(isVisible).length,
                            }))

                        const formElements = Array.from(document.querySelectorAll('form')) as HTMLFormElement[]
                        const inputsRaw = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
                        const textareasRaw = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[]
                        const selectsRaw = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[]
                        const buttonsRaw = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]')) as HTMLElement[]
                        const linksRaw = Array.from(document.querySelectorAll('a[href], [role="link"]')) as HTMLElement[]
                        const labelsRaw = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[]
                        const shouldInclude = (el: Element) => !onlyVisible || (isVisible(el) && !(el as HTMLInputElement).disabled)
                        const formIndexFor = (el: Element) => {
                            const form = (el as HTMLInputElement).form
                            return form ? formElements.indexOf(form) : -1
                        }
                        const fieldInfo = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number, tag: string) => {
                            const visible = isVisible(el)
                            const type = tag === 'input' ? (el as HTMLInputElement).type || 'text' : tag
                            const isPassword = type === 'password'
                            const value = isPassword ? '' : normalizeText((el as HTMLInputElement).value)
                            return {
                                index,
                                selectorHint: selectorFor(el, duplicateIdValues),
                                tag,
                                type,
                                id: el.id || '',
                                name: el.getAttribute('name') || '',
                                placeholder: normalizeText(el.getAttribute('placeholder')),
                                value,
                                hasValue: Boolean((el as HTMLInputElement).value),
                                valueMasked: isPassword,
                                label: labelFor(el),
                                ariaLabel: normalizeText(el.getAttribute('aria-label')),
                                autocomplete: el.getAttribute('autocomplete') || '',
                                visible,
                                disabled: Boolean((el as HTMLInputElement).disabled),
                                readOnly: Boolean((el as HTMLInputElement | HTMLTextAreaElement).readOnly),
                                required: Boolean((el as HTMLInputElement).required),
                                interactive: visible && !Boolean((el as HTMLInputElement).disabled) && !Boolean((el as HTMLInputElement | HTMLTextAreaElement).readOnly),
                                formIndex: formIndexFor(el),
                                nearbyText: nearbyText(el),
                                duplicateId: Boolean(el.id && duplicateIdValues.has(el.id)),
                                boundingBox: boundingBox(el),
                            }
                        }
                        const inputs = inputsRaw.filter(shouldInclude).map((el, index) => fieldInfo(el, index, 'input'))
                        const textareas = textareasRaw.filter(shouldInclude).map((el, index) => fieldInfo(el, index, 'textarea'))
                        const selects = selectsRaw.filter(shouldInclude).map((el, index) => fieldInfo(el, index, 'select'))
                        const buttons = buttonsRaw.filter(shouldInclude).map((el, index) => {
                            const visible = isVisible(el)
                            const input = el as HTMLInputElement
                            return {
                                index,
                                selectorHint: selectorFor(el, duplicateIdValues),
                                tag: el.tagName.toLowerCase(),
                                type: input.type || el.getAttribute('role') || '',
                                id: el.id || '',
                                name: el.getAttribute('name') || '',
                                text: normalizeText(el.textContent || input.value),
                                ariaLabel: normalizeText(el.getAttribute('aria-label')),
                                visible,
                                disabled: Boolean(input.disabled || el.getAttribute('aria-disabled') === 'true'),
                                interactive: visible && !Boolean(input.disabled || el.getAttribute('aria-disabled') === 'true'),
                                formIndex: formIndexFor(el),
                                nearbyText: nearbyText(el),
                                boundingBox: boundingBox(el),
                            }
                        })
                        const links = linksRaw.filter(shouldInclude).map((el, index) => ({
                            index,
                            selectorHint: selectorFor(el, duplicateIdValues),
                            href: (el as HTMLAnchorElement).href || '',
                            text: normalizeText(el.textContent),
                            ariaLabel: normalizeText(el.getAttribute('aria-label')),
                            visible: isVisible(el),
                            interactive: isVisible(el),
                            nearbyText: nearbyText(el),
                            boundingBox: boundingBox(el),
                        }))
                        const labels = labelsRaw.filter(el => !onlyVisible || isVisible(el)).map((el, index) => ({
                            index,
                            selectorHint: selectorFor(el, duplicateIdValues),
                            text: normalizeText(el.textContent),
                            for: el.getAttribute('for') || '',
                            visible: isVisible(el),
                            boundingBox: boundingBox(el),
                        }))
                        const forms = formElements.filter(el => !onlyVisible || isVisible(el)).map((form, index) => ({
                            index,
                            selectorHint: selectorForForm(form, duplicateIdValues),
                            action: form.getAttribute('action') || '',
                            method: (form.getAttribute('method') || 'get').toLowerCase(),
                            visible: isVisible(form),
                            text: normalizeText(form.innerText || form.textContent),
                            inputs: inputs.map((input, inputIndex) => input.formIndex === index ? inputIndex : -1).filter(i => i >= 0),
                            textareas: textareas.map((textarea, textareaIndex) => textarea.formIndex === index ? textareaIndex : -1).filter(i => i >= 0),
                            selects: selects.map((select, selectIndex) => select.formIndex === index ? selectIndex : -1).filter(i => i >= 0),
                            buttons: buttons.map((button, buttonIndex) => button.formIndex === index ? buttonIndex : -1).filter(i => i >= 0),
                        }))
                        return { forms, inputs, textareas, selects, buttons, links, labels, duplicateIds }
                    },
                    { onlyVisible, maxTextLength },
                )
            } catch (error) {
                inspected = { forms: [], inputs: [], textareas: [], selects: [], buttons: [], links: [], labels: [], duplicateIds: [] }
            }

            for (const category of Object.keys(aggregate)) {
                for (const item of inspected[category] || []) {
                    const target = aggregate[category]
                    if (target.length >= maxItems) {
                        truncatedCategories.add(category)
                        continue
                    }
                    target.push({
                        ...item,
                        frameIndex,
                        framePath,
                        frameUrl: frame.url(),
                        frameName: frame.name(),
                        frameSelectorHint: frameSelectorByFrame.get(frame) ?? null,
                    })
                }
            }
        }

        return {
            ok: true,
            url: page.url(),
            title: await page.title(),
            counts: {
                forms: aggregate.forms.length,
                inputs: aggregate.inputs.length,
                textareas: aggregate.textareas.length,
                selects: aggregate.selects.length,
                buttons: aggregate.buttons.length,
                links: aggregate.links.length,
                labels: aggregate.labels.length,
                duplicateIds: aggregate.duplicateIds.length,
                frames: frameEntries.length,
            },
            frames: frameEntries,
            forms: aggregate.forms,
            inputs: aggregate.inputs,
            textareas: aggregate.textareas,
            selects: aggregate.selects,
            buttons: aggregate.buttons,
            links: aggregate.links,
            labels: aggregate.labels,
            duplicateIds: aggregate.duplicateIds,
            truncated: truncatedCategories.size > 0,
            truncatedCategories: Array.from(truncatedCategories),
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
