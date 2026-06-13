import { Injectable } from '@nestjs/common'
import { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolResult, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod/v4'
import { RobotService, VERSION } from 'src/service/robot.service'
import { RunStatusEnum } from 'src/model/robot.model'

@Injectable()
export class McpService {
  private readonly transports: Record<string, StreamableHTTPServerTransport> = {}

  constructor(private readonly robotService: RobotService) {}

  async handlePost(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = this.getHeader(req.headers['mcp-session-id'])
      let transport: StreamableHTTPServerTransport | undefined

      if (sessionId && this.transports[sessionId]) {
        transport = this.transports[sessionId]
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = this.createTransport()
        await this.createServer().connect(transport)
      } else {
        this.sendJsonRpcError(res, 400, -32000, 'Bad Request: No valid session ID provided')
        return
      }

      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      console.error('Error handling MCP POST request:', error)
      if (!res.headersSent) {
        this.sendJsonRpcError(res, 500, -32603, 'Internal server error')
      }
    }
  }

  async handleGet(req: Request, res: Response): Promise<void> {
    const transport = this.getTransportFromRequest(req, res)
    if (!transport) return

    try {
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error('Error handling MCP GET request:', error)
      if (!res.headersSent) {
        res.status(500).send('Error processing MCP request')
      }
    }
  }

  async handleDelete(req: Request, res: Response): Promise<void> {
    const transport = this.getTransportFromRequest(req, res)
    if (!transport) return

    try {
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error('Error handling MCP DELETE request:', error)
      if (!res.headersSent) {
        res.status(500).send('Error processing MCP session termination')
      }
    }
  }

  private createTransport(): StreamableHTTPServerTransport {
    let transport: StreamableHTTPServerTransport
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        console.log(`MCP session initialized: ${sessionId}`)
        this.transports[sessionId] = transport
      },
    })

    transport.onclose = () => {
      const sessionId = transport.sessionId
      if (sessionId && this.transports[sessionId]) {
        console.log(`MCP session closed: ${sessionId}`)
        delete this.transports[sessionId]
      }
    }

    return transport
  }

  private createServer(): McpServer {
    const server = new McpServer({
      name: 'puppeteer-robot-api',
      version: VERSION,
    })
    const waitUntilSchema = z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])

    server.registerTool(
      'get_version',
      {
        title: 'Puppeteer Robot Version',
        description: 'Returns the Puppeteer Robot API version.',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const version = await this.robotService.version()
        return this.textResult({ version })
      },
    )

    server.registerTool(
      'create_robot',
      {
        title: 'Create Puppeteer Robot',
        description: 'Creates a Puppeteer robot instance, optionally associated with a pool.',
        inputSchema: {
          pool: z.string().optional().describe('Optional pool name.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ pool }) => {
        const response = await this.robotService.create(pool ?? null)
        return this.textResult(response)
      },
    )

    server.registerTool(
      'list_robots',
      {
        title: 'List Puppeteer Robots',
        description: 'Lists all active Puppeteer robot instances.',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const robots = await this.robotService.list()
        return this.textResult({ robots })
      },
    )

    server.registerTool(
      'delete_robot',
      {
        title: 'Delete Puppeteer Robot',
        description: 'Deletes or releases a Puppeteer robot instance.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID to delete.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId }) => {
        const deleted = await this.robotService.delete(robotId)
        return this.textResult({ deleted })
      },
    )

    server.registerTool(
      'run_command',
      {
        title: 'Run Puppeteer Command',
        description: 'Runs JavaScript against an active Puppeteer robot page.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID that will execute the command.'),
          command: z.string().min(1).describe('JavaScript command body to run in the Puppeteer context.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ robotId, command }) => {
        const response = await this.robotService.run({ robotId, command })
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'run_javascript_on_page',
      {
        title: 'Run JavaScript on Puppeteer Page',
        description: 'Runs JavaScript inside the browser page context with access to window, document, DOM APIs, localStorage, and page fetch.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID that will execute the script.'),
          script: z.string().min(1).describe('JavaScript function body to execute inside the page context. Use return to send data back. Do not wrap in an async IIFE.'),
          args: z.any().optional().describe('Optional serializable value available inside the script as args.'),
          timeoutMs: z.number().int().positive().optional().describe('Page evaluation timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ robotId, script, args, timeoutMs }) => {
        const response = await this.robotService.runJavascriptOnPage(robotId, script, args, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'navigate',
      {
        title: 'Navigate Puppeteer Robot',
        description: 'Navigates the robot page to a URL and returns the resulting page URL and title.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID that will navigate.'),
          url: z.string().url().describe('URL to open.'),
          waitUntil: waitUntilSchema.optional().describe('Puppeteer navigation wait condition. Defaults to networkidle2.'),
          timeoutMs: z.number().int().positive().optional().describe('Navigation timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ robotId, url, waitUntil, timeoutMs }) => {
        const response = await this.robotService.navigate(robotId, url, waitUntil, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'type',
      {
        title: 'Type Text in Puppeteer Robot',
        description: 'Types text into an editable element selected by CSS selector.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          selector: z.string().min(1).describe('CSS selector for the editable element.'),
          text: z.string().describe('Text to type.'),
          clearBefore: z.boolean().optional().describe('Whether to clear the current field value before typing. Defaults to false.'),
          timeoutMs: z.number().int().positive().optional().describe('Selector timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId, selector, text, clearBefore, timeoutMs }) => {
        const response = await this.robotService.typeText(robotId, selector, text, clearBefore, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'set_value',
      {
        title: 'Set Field Value in Puppeteer Robot',
        description: 'Sets a form field value directly in the page DOM and optionally dispatches DOM events.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          selector: z.string().min(1).describe('CSS selector for the target element.'),
          value: z.string().describe('Value to assign.'),
          dispatchEvents: z.array(z.string().min(1)).optional().describe('DOM events to dispatch after setting the value. Defaults to input and change.'),
          timeoutMs: z.number().int().positive().optional().describe('Selector timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId, selector, value, dispatchEvents, timeoutMs }) => {
        const response = await this.robotService.setValue(robotId, selector, value, dispatchEvents, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'click',
      {
        title: 'Click Element in Puppeteer Robot',
        description: 'Clicks an element selected by CSS selector, optionally waiting for navigation.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          selector: z.string().min(1).describe('CSS selector for the element to click.'),
          waitForNavigation: z.boolean().optional().describe('Whether to wait for navigation caused by the click. Defaults to false.'),
          waitUntil: waitUntilSchema.optional().describe('Navigation wait condition when waitForNavigation is true. Defaults to networkidle2.'),
          timeoutMs: z.number().int().positive().optional().describe('Selector/navigation timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ robotId, selector, waitForNavigation, waitUntil, timeoutMs }) => {
        const response = await this.robotService.click(robotId, selector, waitForNavigation, waitUntil, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'wait_for_navigation',
      {
        title: 'Wait for Puppeteer Navigation',
        description: 'Waits for the current robot page to finish a navigation.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          waitUntil: waitUntilSchema.optional().describe('Puppeteer navigation wait condition. Defaults to networkidle2.'),
          timeoutMs: z.number().int().positive().optional().describe('Navigation timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId, waitUntil, timeoutMs }) => {
        const response = await this.robotService.waitForNavigation(robotId, waitUntil, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'get_html',
      {
        title: 'Get Puppeteer Page HTML',
        description: 'Returns the current page HTML, URL, and title.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId }) => {
        const response = await this.robotService.getHtml(robotId)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'get_text',
      {
        title: 'Get Puppeteer Page Text',
        description: 'Returns visible text from the whole page or from a selected element.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          selector: z.string().optional().describe('Optional CSS selector. If omitted, document.body is used.'),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId, selector }) => {
        const response = await this.robotService.getText(robotId, selector)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'upload_file_to_input',
      {
        title: 'Upload File to Input',
        description: 'Uploads a previously uploaded server file to a page input[type=file].',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          selector: z.string().min(1).describe('CSS selector for the file input.'),
          hash: z.string().min(1).describe('Upload hash returned by the upload endpoint.'),
          timeoutMs: z.number().int().positive().optional().describe('Selector timeout in milliseconds. Defaults to 30000.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId, selector, hash, timeoutMs }) => {
        const response = await this.robotService.uploadFileToInput(robotId, selector, hash, timeoutMs)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'download_url',
      {
        title: 'Download URL with Puppeteer Session',
        description: 'Downloads a URL through the API server using the current page cookies, user agent, and referer.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
          url: z.string().url().describe('HTTP or HTTPS URL to download.'),
          fileName: z.string().optional().describe('Optional file name to use when saving the downloaded file.'),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ robotId, url, fileName }) => {
        const response = await this.robotService.downloadUrl(robotId, url, fileName)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'get_file',
      {
        title: 'Get Downloaded File',
        description: 'Returns a previously downloaded file as MCP embedded resource content with base64 data.',
        inputSchema: {
          fileId: z.string().min(1).describe('Downloaded file ID returned by download_url or downloadUrl.'),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ fileId }) => {
        const result = this.robotService.getDownloadedFile(fileId)
        if (!result.ok || !result.filePath || !result.metadata) {
          return this.errorResult({ ok: false, message: result.message || 'Downloaded file not found' })
        }

        const base64 = fs.readFileSync(result.filePath).toString('base64')
        const fileName = result.metadata.fileName || 'download'
        const mimeType = result.metadata.mimeType || 'application/octet-stream'
        const structuredContent = {
          ok: true,
          fileId,
          fileName,
          mimeType,
          size: result.metadata.size,
        }

        return {
          content: [
            {
              type: 'resource',
              resource: {
                uri: `puppeteer-robot-file://${fileId}/${fileName}`,
                mimeType,
                blob: base64,
              },
            },
            {
              type: 'text',
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        }
      },
    )

    server.registerTool(
      'page_info',
      {
        title: 'Get Puppeteer Page Info',
        description: 'Returns lightweight information about the current robot page.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID.'),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId }) => {
        const response = await this.robotService.pageInfo(robotId)
        return this.commandResult(response)
      },
    )

    server.registerTool(
      'take_screenshot',
      {
        title: 'Take Puppeteer Screenshot',
        description: 'Takes a PNG screenshot from an active Puppeteer robot page.',
        inputSchema: {
          robotId: z.string().min(1).describe('Robot ID to screenshot.'),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ robotId }) => {
        const response = await this.robotService.screenshot(robotId)
        if (response.status !== RunStatusEnum.OK || typeof response.data !== 'string') {
          return this.errorResult(response)
        }

        return {
          content: [
            {
              type: 'image',
              data: response.data,
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: JSON.stringify({ status: response.status }, null, 2),
            },
          ],
          structuredContent: {
            status: response.status,
          },
        }
      },
    )

    return server
  }

  private commandResult(response: { status?: unknown }): CallToolResult {
    if (response.status && response.status !== RunStatusEnum.OK) {
      return this.errorResult(response)
    }
    return this.textResult(response)
  }

  private textResult(data: object): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
      structuredContent: data as Record<string, unknown>,
    }
  }

  private errorResult(data: object): CallToolResult {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
      structuredContent: data as Record<string, unknown>,
    }
  }

  private getTransportFromRequest(req: Request, res: Response): StreamableHTTPServerTransport | undefined {
    const sessionId = this.getHeader(req.headers['mcp-session-id'])
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send('Invalid or missing MCP session ID')
      return undefined
    }
    return this.transports[sessionId]
  }

  private getHeader(header: string | string[] | undefined): string | undefined {
    return Array.isArray(header) ? header[0] : header
  }

  private sendJsonRpcError(res: Response, httpStatus: number, code: number, message: string): void {
    res.status(httpStatus).json({
      jsonrpc: '2.0',
      error: {
        code,
        message,
      },
      id: null,
    })
  }
}
