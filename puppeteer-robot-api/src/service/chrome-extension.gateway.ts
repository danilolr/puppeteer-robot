import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { Socket } from 'socket.io'
import {
  ChromeExtensionRegisterPayload,
  ChromeExtensionRegistryService,
  ChromeExtensionTab,
} from './chrome-extension-registry.service'
import { WsGateway } from './ws.gateway'

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChromeExtensionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly registry: ChromeExtensionRegistryService,
    private readonly wsGateway: WsGateway,
  ) {}

  handleConnection(client: Socket) {
    const session = this.registry.addConnection(client)
    if (session) {
      this.notifyListChanged()
    }
  }

  handleDisconnect(client: Socket) {
    if (this.registry.removeBySocketId(client.id)) {
      this.notifyListChanged()
    }
  }

  @SubscribeMessage('extension:register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChromeExtensionRegisterPayload,
  ) {
    const session = this.registry.updateRegistration(client, payload)
    if (session) {
      this.notifyListChanged()
    }
    return session
  }

  @SubscribeMessage('extension:tab:update')
  handleTabUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChromeExtensionTab,
  ) {
    const session = this.registry.updateTab(client.id, payload)
    if (session) {
      this.notifyListChanged()
    }
    return session
  }

  @SubscribeMessage('extension:tabs:update')
  handleTabsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChromeExtensionTab[],
  ) {
    const session = this.registry.updateTabs(client.id, payload)
    if (session) {
      this.notifyListChanged()
    }
    return session
  }

  @SubscribeMessage('extension:heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    return this.registry.touchBySocketId(client.id)
  }

  private notifyListChanged(): void {
    this.wsGateway.send('updateList', {})
  }
}
