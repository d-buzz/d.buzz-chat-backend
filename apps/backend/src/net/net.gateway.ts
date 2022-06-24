import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Cache } from 'cache-manager';
import { Inject, CACHE_MANAGER } from '@nestjs/common';
import { Socket } from 'socket.io';

import { Database } from "./database"
import { SignableMessage, Utils } from '@app/stlib'

/* 
    Maximum time difference between signed message time
    and server time to accept the message.
*/
const MAX_TIME_DIFFERENCE = 300000; //5 minutes
/*
    Minimum time a newly broadcasted message is to be
    cached locally.
*/
const MIN_CACHE_SECONDS = ((MAX_TIME_DIFFERENCE*2)/1000)+60; 

@WebSocketGateway({ 
    cors: {origin: '*'}, transports: ['websocket', 'polling']  })
export class NetGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server;

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}    

    @SubscribeMessage('r')
	async onRead(client: Socket, data: any): Promise<any> {
        const args:any = data;
        const conversation = args[1]; 
        const from = args[2];
        const to = args[3];

        //TODO reader cache?
        
        const result:any = await Database.read(conversation, from, to);

        for(var i = 0; i < result.length; i++) {
            var message = result[i];
            result[i] = ["w", message.username, message.conversation,
                         message.json,
                         new Date(message.timestamp).getTime(),
                         message.keytype,
                         message.signature.toString('hex')];
        }
        return result;
    }

    @SubscribeMessage('w')
	async onWrite(client: Socket, data: string): Promise<string> {
        var signableMessage = SignableMessage.fromJSON(data);

        //Check the time difference
	    if(Math.abs(signableMessage.getTimestamp()-Utils.utcTime()) 
            > MAX_TIME_DIFFERENCE) { //5mins
		    return '"timestamp too different from current time"';
	    }
        //was message was already received by another node?
        var isCached = await this.cacheManager.get(data);
        if(isCached) return "false";

        //Write to database
        if(Database.write(signableMessage)) {
            //on sucess cache
            await this.cacheManager.set(data, true,
                 {ttl: MIN_CACHE_SECONDS});
            //send to all other nodes
            this.server.to("#nodes").emit("w", data);
            //send to interested clients
            if(signableMessage.isGroupConversation()) {
                var users: string[] = signableMessage.getGroupUsernames();
                var rooms = this.server;
                for(var user of users) rooms = rooms.to(user);
                rooms.emit("w", data);
            }
            else this.server.to(signableMessage.getConversation())
                    .emit("w", data);
            return "true";
        }
        return "false";
    }

    @SubscribeMessage('n')
	async onNewNode(client: Socket, data: string): Promise<string> {
        client.join("#nodes");
        return "true";
    }

    @SubscribeMessage('j')
	async onJoinRoom(client: Socket, data: string): Promise<string> {
        client.join(data);
        return "true";
    }

    @SubscribeMessage('l')
	async onLeaveRoom(client: Socket, data: string): Promise<string> {
        client.leave(data);
        return "true";
    }

    async afterInit(socket: Socket): Promise<void> {
       
    }

    async handleConnection(client: Socket): Promise<void> {
        
    }

    async handleDisconnect(client: Socket) {
        //this.connectedUsers.delete(client.id);
    }
}

