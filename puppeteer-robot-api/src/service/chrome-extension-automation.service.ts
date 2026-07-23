import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { RobotCommandResp, RobotCreateResp, RobotInfo, RobotStatusEnum, RunStatusEnum } from 'src/model/robot.model'
import { ChromeExtensionRegistryService } from './chrome-extension-registry.service'

interface ExtensionAck {
  status?: string
  result?: unknown
  resultType?: string
  error?: string
  tab?: unknown
}

@Injectable()
export class ChromeExtensionAutomationService {
  constructor(private readonly registry: ChromeExtensionRegistryService) {}

  create(pool: string | null, instanceId?: string): RobotCreateResp {
    const session = instanceId ? this.registry.get(instanceId) : this.registry.reserve(pool)
    if (!session) {
      return {
        ok: false,
        errorCode: 'CHROME_EXTENSION_NOT_FOUND',
        message: instanceId
          ? `Chrome extension instance not found: ${instanceId}`
          : `No idle Chrome extension session found for pool: ${pool ?? 'none'}`,
      }
    }

    if (instanceId) {
      if (session.status !== RobotStatusEnum.IDLE) {
        return {
          ok: false,
          errorCode: 'CHROME_EXTENSION_BUSY',
          message: `Chrome extension session is not idle: ${instanceId}`,
        }
      }
      session.status = RobotStatusEnum.BUSY
      session.lastSeenAt = new Date()
    }

    return {
      ok: true,
      robotId: session.instanceId,
      isFromPool: true,
      backend: 'chrome-extension',
    }
  }

  delete(robotId: string): boolean {
    return this.registry.release(robotId)
  }

  has(robotId: string): boolean {
    return this.registry.has(robotId)
  }

  getSessionId(robotId: string): string | undefined {
    return this.registry.get(robotId)?.connectedAt.toISOString()
  }

  list(): RobotInfo[] {
    return this.registry.list().map(session => ({
      robotId: session.instanceId,
      backend: 'chrome-extension',
      pool: session.pool ?? undefined,
      isIdleOnPool: session.status === RobotStatusEnum.IDLE,
      createdAt: session.connectedAt,
      status: session.status,
      currentTab: session.currentTab,
      tabs: session.tabs,
      errorInfo: undefined,
    }) as RobotInfo)
  }

  async runCommand(dto: { robotId: string, command: string }): Promise<RobotCommandResp> {
    return this.executeCode(dto.robotId, dto.command, 10000)
  }

  async runJavascriptOnPage(robotId: string, script: string, args?: unknown, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      const args = ${this.js(args ?? {})};
      ${script}
      `,
      timeoutMs,
    )
  }

  async navigate(robotId: string, url: string, _waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      window.location.href = ${this.js(url)};
      return {
        ok: true,
        url: window.location.href,
        title: document.title
      };
      `,
      timeoutMs,
    )
  }

  async typeText(robotId: string, selector: string, text: string, clearBefore = false, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      const selector = ${this.js(selector)};
      const text = ${this.js(text)};
      const clearBefore = ${this.js(Boolean(clearBefore))};
      const element = document.querySelector(selector);
      if (!element) {
        return { ok: false, message: 'Selector not found: ' + selector };
      }
      if (!('value' in element) && !element.isContentEditable) {
        return { ok: false, message: 'Element is not editable: ' + selector };
      }
      element.focus?.();
      if (element.isContentEditable) {
        if (clearBefore) element.textContent = '';
        element.textContent = String(element.textContent || '') + text;
      } else {
        if (clearBefore) element.value = '';
        element.value = String(element.value || '') + text;
      }
      for (const eventName of ['input', 'change']) {
        element.dispatchEvent(new Event(eventName, { bubbles: true }));
      }
      return {
        ok: true,
        selector,
        value: element.isContentEditable ? element.textContent : element.value
      };
      `,
      timeoutMs,
    )
  }

  async setValue(robotId: string, selector: string, value: string, dispatchEvents: string[] = ['input', 'change'], timeoutMs?: number): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      const selector = ${this.js(selector)};
      const value = ${this.js(value)};
      const dispatchEvents = ${this.js(dispatchEvents)};
      const element = document.querySelector(selector);
      if (!element) {
        return { ok: false, message: 'Selector not found: ' + selector };
      }
      if (!('value' in element) && !element.isContentEditable) {
        return { ok: false, message: 'Element cannot receive value: ' + selector };
      }
      element.focus?.();
      if (element.isContentEditable) {
        element.textContent = value;
      } else {
        element.value = value;
      }
      for (const eventName of dispatchEvents) {
        element.dispatchEvent(new Event(eventName, { bubbles: true }));
      }
      return {
        ok: true,
        selector,
        value: element.isContentEditable ? element.textContent : element.value
      };
      `,
      timeoutMs,
    )
  }

  async click(robotId: string, selector: string, _waitForNavigation?: boolean, _waitUntil?: string, timeoutMs?: number): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      const selector = ${this.js(selector)};
      const element = document.querySelector(selector);
      if (!element) {
        return { ok: false, message: 'Selector not found: ' + selector };
      }
      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center', inline: 'center' });
      }
      element.click();
      return {
        ok: true,
        selector,
        url: window.location.href,
        title: document.title
      };
      `,
      timeoutMs,
    )
  }

  async getHtml(robotId: string): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      return {
        ok: true,
        html: document.documentElement.outerHTML,
        url: window.location.href,
        title: document.title
      };
      `,
    )
  }

  async getText(robotId: string, selector?: string): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      const selector = ${this.js(selector ?? null)};
      const element = selector ? document.querySelector(selector) : document.body;
      if (!element) {
        return { ok: false, message: 'Selector not found: ' + selector };
      }
      return {
        ok: true,
        selector,
        text: element.innerText || element.textContent || '',
        url: window.location.href,
        title: document.title
      };
      `,
    )
  }

  async pageInfo(robotId: string): Promise<RobotCommandResp> {
    return this.executeCode(
      robotId,
      `
      return {
        ok: true,
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        visibilityState: document.visibilityState,
        userAgent: navigator.userAgent,
        language: navigator.language
      };
      `,
    )
  }

  async inspectInteractiveElements(robotId: string, options?: {
    onlyVisible?: boolean
    maxItems?: number
    maxTextLength?: number
  }): Promise<RobotCommandResp> {
    const onlyVisible = options?.onlyVisible ?? true
    const maxItems = this.normalizeBoundedInteger(options?.maxItems, 50, 1, 500)
    const maxTextLength = this.normalizeBoundedInteger(options?.maxTextLength, 120, 20, 1000)

    return this.executeCode(
      robotId,
      `
      const onlyVisible = ${this.js(onlyVisible)};
      const maxItems = ${this.js(maxItems)};
      const maxTextLength = ${this.js(maxTextLength)};
      const normalizeText = (value) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, maxTextLength);
      const isVisible = (element) => {
        if (!onlyVisible) return true;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        let current = element;
        while (current) {
          const style = window.getComputedStyle(current);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
          }
          current = current.parentElement;
        }
        return true;
      };
      const cssEscape = (value) => {
        if (window.CSS?.escape) return window.CSS.escape(value);
        return String(value).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
      };
      const selectorFor = (element) => {
        const tag = element.tagName.toLowerCase();
        if (element.id) return tag + '#' + cssEscape(element.id);
        const name = element.getAttribute('name');
        if (name) return tag + '[name="' + cssEscape(name) + '"]';
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return tag + '[aria-label="' + cssEscape(ariaLabel) + '"]';
        const placeholder = element.getAttribute('placeholder');
        if (placeholder) return tag + '[placeholder="' + cssEscape(placeholder) + '"]';
        const classes = Array.from(element.classList || []).filter(Boolean).slice(0, 2);
        if (classes.length) return tag + '.' + classes.map(cssEscape).join('.');
        const parent = element.parentElement;
        if (!parent) return tag;
        const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
        return tag + ':nth-of-type(' + (siblings.indexOf(element) + 1) + ')';
      };
      const mapElements = (query) => Array.from(document.querySelectorAll(query))
        .filter(isVisible)
        .slice(0, maxItems)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            selectorHint: selectorFor(element),
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            name: element.getAttribute('name'),
            type: element.getAttribute('type'),
            text: normalizeText(element.innerText || element.textContent),
            ariaLabel: element.getAttribute('aria-label'),
            placeholder: element.getAttribute('placeholder'),
            href: element.getAttribute('href'),
            visible: isVisible(element),
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
        });
      return {
        ok: true,
        url: window.location.href,
        title: document.title,
        forms: mapElements('form'),
        inputs: mapElements('input'),
        textareas: mapElements('textarea'),
        selects: mapElements('select'),
        buttons: mapElements('button, [role="button"], input[type="button"], input[type="submit"]'),
        links: mapElements('a[href]'),
        labels: mapElements('label')
      };
      `,
    )
  }

  private async executeCode(robotId: string, code: string, timeoutMs = 10000): Promise<RobotCommandResp> {
    const session = this.registry.get(robotId)
    if (!session) {
      return {
        status: RunStatusEnum.ROBOT_NOT_FOUND,
        message: `Chrome extension session not found: ${robotId}`,
        data: null,
      }
    }

    const commandId = randomUUID()
    try {
      const ackResult = await session.socket.timeout(this.normalizeTimeout(timeoutMs)).emitWithAck('execute:command', {
        commandId,
        code,
        target: { type: 'activeTab' },
        executionWorld: 'main',
        timeoutMs: this.normalizeTimeout(timeoutMs),
        requestedAt: new Date().toISOString(),
      })
      const ack = this.normalizeAck(ackResult)
      if (ack.status === 'success') {
        return {
          status: RunStatusEnum.OK,
          data: ack.result,
        }
      }
      return {
        status: RunStatusEnum.JAVASCRIPT_EXCEPTION_ERROR,
        message: ack.error || 'Chrome extension command failed',
        data: ack.result ?? null,
      }
    } catch (error) {
      return {
        status: RunStatusEnum.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : String(error),
        data: null,
      }
    }
  }

  private normalizeAck(value: unknown): ExtensionAck {
    return value && typeof value === 'object' ? value as ExtensionAck : {}
  }

  private normalizeTimeout(value: unknown): number {
    const timeout = Number(value)
    if (!Number.isFinite(timeout)) {
      return 10000
    }
    return Math.min(Math.max(Math.trunc(timeout), 1000), 60000)
  }

  private normalizeBoundedInteger(value: unknown, defaultValue: number, min: number, max: number): number {
    if (value === undefined || value === null) {
      return defaultValue
    }
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) {
      return defaultValue
    }
    return Math.min(Math.max(Math.trunc(numberValue), min), max)
  }

  private js(value: unknown): string {
    return JSON.stringify(value)
  }
}
