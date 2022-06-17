import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Socket } from 'socket.io';

@WebSocketGateway({ cors: {  origin: '*' } })
export class NetGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server;

    async handleConnection(client: Socket): Promise<void> {
        
    }

    async handleDisconnect(client: Socket) {
        //this.connectedUsers.delete(client.id);
    }

    @SubscribeMessage('message')
	async onMessage(client: Socket, data: string): Promise<string> {
        return "hello " + data;
    }

 
}

