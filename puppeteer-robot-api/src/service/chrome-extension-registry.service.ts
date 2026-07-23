import { Injectable } from '@nestjs/common'
import { Socket } from 'socket.io'
import { RobotStatusEnum } from 'src/model/robot.model'

export interface ChromeExtensionRegisterPayload {
  instanceId?: string
  instanceName?: string
  extensionId?: string
  version?: string
  pool?: string
}

export interface ChromeExtensionTab {
  id?: number
  url?: string
  title?: string
  active?: boolean
  windowId?: number
}

export interface ChromeExtensionSession {
  instanceId: string
  socketId: string
  instanceName?: string
  extensionId?: string
  version?: string
  pool?: string | null
  connectedAt: Date
  lastSeenAt: Date
  status: RobotStatusEnum
  currentTab?: ChromeExtensionTab
  tabs: ChromeExtensionTab[]
  socket: Socket
}

export type ChromeExtensionSessionView = Omit<ChromeExtensionSession, 'socket'>

type SocketAuth = Partial<Record<'instanceId' | 'instanceName' | 'extensionId' | 'version' | 'pool', unknown>>

@Injectable()
export class ChromeExtensionRegistryService {
  private readonly byInstanceId = new Map<string, ChromeExtensionSession>()
  private readonly instanceIdBySocketId = new Map<string, string>()

  updateRegistration(socket: Socket, payload: ChromeExtensionRegisterPayload = {}): ChromeExtensionSessionView | null {
    const existing = this.getBySocketId(socket.id)
    if (!existing) {
      return this.addConnection(socket, payload)
    }

    return this.updateExistingRegistration(existing, socket.id, payload)
  }

  removeBySocketId(socketId: string): boolean {
    const instanceId = this.instanceIdBySocketId.get(socketId)
    if (!instanceId) {
      return false
    }

    this.instanceIdBySocketId.delete(socketId)
    this.byInstanceId.delete(instanceId)
    return true
  }

  addConnection(socket: Socket, payload?: ChromeExtensionRegisterPayload): ChromeExtensionSessionView | null {
    const now = new Date()
    const auth = this.getSocketAuth(socket)
    const metadata = payload ?? auth
    const instanceId = this.cleanString(metadata.instanceId)
    if (!instanceId || !this.isExtensionHandshake(metadata)) {
      return null
    }

    const existing = this.byInstanceId.get(instanceId)
    if (existing) {
      if (existing.socketId !== socket.id) {
        this.instanceIdBySocketId.delete(existing.socketId)
      }
      existing.socket = socket
      existing.socketId = socket.id
      existing.lastSeenAt = now
      this.instanceIdBySocketId.set(socket.id, instanceId)
      return this.updateExistingRegistration(existing, socket.id, metadata)
    }

    const session: ChromeExtensionSession = {
      instanceId,
      socketId: socket.id,
      instanceName: this.cleanString(metadata.instanceName),
      extensionId: this.cleanString(metadata.extensionId),
      version: this.cleanString(metadata.version),
      pool: this.normalizePool(this.cleanString(metadata.pool)),
      connectedAt: now,
      lastSeenAt: now,
      status: RobotStatusEnum.IDLE,
      tabs: [],
      socket,
    }

    this.byInstanceId.set(instanceId, session)
    this.instanceIdBySocketId.set(socket.id, instanceId)
    return this.toView(session)
  }

  private updateExistingRegistration(
    existing: ChromeExtensionSession,
    socketId: string,
    payload: ChromeExtensionRegisterPayload | SocketAuth = {},
  ): ChromeExtensionSessionView | null {
    if (!existing) {
      return null
    }

    const nextInstanceId = this.cleanString(payload.instanceId)
    if (nextInstanceId && nextInstanceId !== existing.instanceId) {
      this.byInstanceId.delete(existing.instanceId)
      existing.instanceId = nextInstanceId
      this.byInstanceId.set(nextInstanceId, existing)
      this.instanceIdBySocketId.set(socketId, nextInstanceId)
    }

    existing.instanceName = this.cleanString(payload.instanceName) ?? existing.instanceName
    existing.extensionId = this.cleanString(payload.extensionId) ?? existing.extensionId
    existing.version = this.cleanString(payload.version) ?? existing.version
    existing.pool = this.normalizePool(this.cleanString(payload.pool) ?? existing.pool ?? undefined)
    existing.lastSeenAt = new Date()
    return this.toView(existing)
  }

  updateTab(socketId: string, payload: ChromeExtensionTab = {}): ChromeExtensionSessionView | null {
    const existing = this.getBySocketId(socketId)
    if (!existing) {
      return null
    }

    existing.currentTab = this.normalizeTab(payload)
    existing.lastSeenAt = new Date()
    return this.toView(existing)
  }

  updateTabs(socketId: string, payload: ChromeExtensionTab[] = []): ChromeExtensionSessionView | null {
    const existing = this.getBySocketId(socketId)
    if (!existing) {
      return null
    }

    existing.tabs = Array.isArray(payload) ? payload.map(tab => this.normalizeTab(tab)) : []
    existing.lastSeenAt = new Date()
    return this.toView(existing)
  }

  touchBySocketId(socketId: string): ChromeExtensionSessionView | null {
    const existing = this.getBySocketId(socketId)
    if (!existing) {
      return null
    }

    existing.lastSeenAt = new Date()
    return this.toView(existing)
  }

  reserve(pool: string | null): ChromeExtensionSession | null {
    for (const session of this.byInstanceId.values()) {
      if (session.status === RobotStatusEnum.IDLE && this.matchesPool(session.pool ?? null, pool)) {
        session.status = RobotStatusEnum.BUSY
        session.lastSeenAt = new Date()
        return session
      }
    }

    return null
  }

  release(instanceId: string): boolean {
    const session = this.byInstanceId.get(instanceId)
    if (!session) {
      return false
    }

    session.status = RobotStatusEnum.IDLE
    session.lastSeenAt = new Date()
    return true
  }

  markError(instanceId: string): void {
    const session = this.byInstanceId.get(instanceId)
    if (session) {
      session.status = RobotStatusEnum.ERROR
      session.lastSeenAt = new Date()
    }
  }

  list(): ChromeExtensionSessionView[] {
    return [...this.byInstanceId.values()].map(session => this.toView(session))
  }

  get(instanceId: string): ChromeExtensionSession | undefined {
    return this.byInstanceId.get(instanceId)
  }

  has(instanceId: string): boolean {
    return this.byInstanceId.has(instanceId)
  }

  private getBySocketId(socketId: string): ChromeExtensionSession | undefined {
    const instanceId = this.instanceIdBySocketId.get(socketId)
    return instanceId ? this.byInstanceId.get(instanceId) : undefined
  }

  private toView(session: ChromeExtensionSession): ChromeExtensionSessionView {
    return {
      instanceId: session.instanceId,
      socketId: session.socketId,
      instanceName: session.instanceName,
      extensionId: session.extensionId,
      version: session.version,
      pool: session.pool,
      connectedAt: session.connectedAt,
      lastSeenAt: session.lastSeenAt,
      status: session.status,
      currentTab: session.currentTab,
      tabs: session.tabs,
    }
  }

  private matchesPool(sessionPool: string | null, requestedPool: string | null): boolean {
    return (sessionPool || null) === (requestedPool || null)
  }

  private normalizePool(pool?: string | null): string | null {
    return !pool || pool === 'none' ? null : pool
  }

  private normalizeTab(tab: ChromeExtensionTab): ChromeExtensionTab {
    return {
      id: typeof tab.id === 'number' ? tab.id : undefined,
      url: this.cleanString(tab.url),
      title: this.cleanString(tab.title),
      active: typeof tab.active === 'boolean' ? tab.active : undefined,
      windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined,
    }
  }

  private cleanString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }

  private getSocketAuth(socket: Socket): SocketAuth {
    const auth = socket.handshake.auth
    return auth && typeof auth === 'object' ? auth : {}
  }

  private isExtensionHandshake(auth: SocketAuth): boolean {
    return Boolean(this.cleanString(auth.extensionId) || this.cleanString(auth.version) || this.cleanString(auth.instanceName))
  }
}
