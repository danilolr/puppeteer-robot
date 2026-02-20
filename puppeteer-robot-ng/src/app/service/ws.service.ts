import { Injectable, signal } from "@angular/core"
import { io } from "socket.io-client"
import { ConfigService } from "./config.service"

@Injectable({
    providedIn: 'root'
})
export class WsService {
    private socket
    wsIsConnected = signal(false)

    constructor(readonly configService: ConfigService) {
        this.socket = io(configService.wsPath, {
            transports: ["websocket"]
        })
        this.socket.on("connect", () => {
            console.log("WebSocket connected with id:", this.socket.id)
            this.wsIsConnected.set(true)
        })
        this.socket.on("disconnect", () => {
            console.log("WebSocket disconnected")
            this.wsIsConnected.set(false)
        })
    }
    
    public sendMessage(message: string) {
        this.socket.emit("message", message)
    }

    public onEvent(event: string, callback: (data: any) => void) {
        this.socket.on(event, callback)
    }

}