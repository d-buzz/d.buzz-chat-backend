import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Message } from "../entity/Message"
import { getConnection} from "typeorm";
import { AppDataSource } from "../data-source"

import { Socket } from 'socket.io';
//import { SignableMessage } from '@app/stlib/signable-message';
import { SignableMessage } from '../../libs/stlib/src/signable-message';


@WebSocketGateway({ cors: {  origin: '*' } })
export class NetGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server;

    async afterInit(socket: Socket): Promise<void> {
        //this.server.setTransport(["websocket"]);
    }

    async handleConnection(client: Socket): Promise<void> {
        
    }

    async handleDisconnect(client: Socket) {
        //this.connectedUsers.delete(client.id);
    }

    @SubscribeMessage('message')
	async onMessage(client: Socket, data: string): Promise<string> {
        console.log("data " + data);
        return "hello " + data;
    }

    @SubscribeMessage('r')
	async onRead(client: Socket, data: string): Promise<string> {
        const args:any = JSON.parse(data);
        const parameters = {
            conversation: args[1], 
            from: new Date(args[2]),
            to: new Date(args[3])
        };
        console.log(parameters);
        
        const result:any = await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .where("m.conversation = :conversation")
            .andWhere("m.timestamp BETWEEN :from AND :to")
            .limit(100)
            .setParameters(parameters)
            .getMany();
           //.getSql();

        for(var i = 0; i < result.length; i++) {
            var message = result[i];
            result[i] = ["w", message.username, message.conversation,
                         message.json,
                         new Date(message.timestamp).getTime(),
                         message.keytype,
                         message.signature.toString('hex')];
        }
        return JSON.stringify(result);
    }

    @SubscribeMessage('w')
	async onWrite(client: Socket, data: string): Promise<string> {
        var message = SignableMessage.fromJSON(data);
        
        return "hello " + data;
    }

}

