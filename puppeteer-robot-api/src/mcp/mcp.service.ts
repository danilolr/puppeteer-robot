import { Injectable } from '@nestjs/common'
import { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
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

    server.registerTool(
      'puppeteer_robot_version',
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
      'puppeteer_robot_create',
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
      'puppeteer_robot_list',
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
      'puppeteer_robot_delete',
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
      'puppeteer_robot_run_command',
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
      'puppeteer_robot_screenshot',
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
