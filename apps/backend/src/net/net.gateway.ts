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

import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { P2PNetwork } from "./p2p-network"
import { NetMethods } from "./net-methods"
import { Database } from "./database"
import { Content, SignableMessage, Utils } from '@app/stlib'
import { NodeSetup } from "../data-source"

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

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
        var _this = this;
        NetMethods.initialize(async (data)=>{
            return await _this.onWrite(null, data);
        }, ()=>{
            return _this.connectedNodes();
        });
        Utils.setNode(true);
        Utils.setReadPreferenceFunction(async (user)=>{
            var result = await NetMethods.readPreferences(user);
            if(result[0]) 
                return Content.fromJSON(JSON.parse(result[1][3])); 
            return null;
        });
        var dataCache = Utils.getStreamDataCache();
        dataCache.begin();
    }    

    async afterInit(socket: Socket): Promise<void> {
        var num = await P2PNetwork.loadNodes(NodeSetup.nodes);
        console.log("loaded " + num + " nodes ");
    }

    @SubscribeMessage('r')
	async onRead(client: Socket, data: any): Promise<any> {
        return await NetMethods.read(data);
    }

    @SubscribeMessage('w')
	async onWrite(client: Socket, data: string): Promise<any[]> {
        var signableMessage = SignableMessage.fromJSON(data);
        //Check the time difference
	    if(Math.abs(signableMessage.getTimestamp()-Utils.utcTime()) 
            > MAX_TIME_DIFFERENCE) { //5mins
		    return [false, "error: Timestamp too different from current time."];
	    }
        //was message was already received by another node?
        var isCached = await this.cacheManager.get(data);
        if(isCached) return [false, "warning: already received."];

        //Write to database
        var databaseResult = await Database.write(signableMessage);
        if(databaseResult[0]) {
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
            return ["true", null];
        }
        return databaseResult;
    }

    @SubscribeMessage('n')
	async onNewNode(client: Socket, data: any): Promise<any[]> {
        var name = data.name;
        if(name !== NodeSetup.name) return [false, 
            'different network ' + NodeSetup.name + ' != ' + name];
        var user = data.user;
        var host = data.host;
        //var path = user+':'+host;
        //var id = client.id;

        var client0: any = client;
        client0._data = { user, host };
        client.join("#nodes");
        return [true, null];
    }

    connectedNodes(): any[] {
        const connected = this.server.of("/").sockets;
        const rooms = this.server.of("/").adapter.rooms;
        var nodes = rooms.get('#nodes');  
        var result = [];      
        if(nodes === undefined) return result;
        for(var node of nodes) {
            var client:any = connected.get(node);
            if(client === undefined) continue;
            result.push(client._data);
        }
        return result;
    } 

    @SubscribeMessage('j')
	async onJoinRoom(client: Socket, data: string): Promise<any[]> {
        if(data === '#nodes') return [false, null];
    
        client.join(data);
        return [true, null];
    }

    @SubscribeMessage('l')
	async onLeaveRoom(client: Socket, data: string): Promise<any[]> {
        if(data === '#nodes') return [false, null];

        client.leave(data);
        return [true, null];
    }

    @SubscribeMessage('v')
	async onVersionRequest(client: Socket, data: string): Promise<any[]> {
        return [true, Utils.getVersion()];
    }

    @SubscribeMessage('i')
	async onInfo(client: Socket, data: string): Promise<any[]> {
        return await NetMethods.info();
    }

    
    async handleConnection(client: Socket): Promise<void> {
        
    }

    async handleDisconnect(client: Socket) {
        //console.log("disconnected " + client.id);
        //this.connectedUsers.delete(client.id);
    }
}

