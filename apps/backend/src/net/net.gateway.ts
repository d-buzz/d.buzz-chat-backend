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
import { io } from 'socket.io-client';
//import { io } from './socket.io.client';

import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { P2PNetwork, NodeInfo } from "./p2p-network"
import { NetMethods } from "./net-methods"
import { Database } from "./database"
import { Client, Content, SignableMessage, Utils } from '@app/stlib'
import { NodeSetup } from "../data-source"
import { MessageStats } from "../utils/utils.module"

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

    stats: MessageStats

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
        var _this = this;
        NetMethods.initialize(async (data)=>{
            return await _this.onWrite(null, data);
        }, ()=>{
            return _this.connectedNodes();
        }, ()=>{ return [true, _this.stats.data] },
           (time: number)=>{ return _this.sync(time); });
        Utils.setNode(true);
        Utils.setReadPreferenceFunction(async (user)=>{
            var result = await NetMethods.readPreference(user);
            if(result[0]) 
                return Content.fromJSON(JSON.parse(result[1][3])); 
            return null;
        });
        var dataCache = Utils.getStreamDataCache();
        dataCache.begin();

        this.stats = new MessageStats(7);
    }    

    async afterInit(socket: Socket): Promise<void> {
        var time = Utils.utcTime();
        await Database.initialize();
        await Database.readStats(this.stats, time-86400000*this.stats.days, time);
        var num = await P2PNetwork.loadNodes(NodeSetup.nodes);
        console.log("loaded " + num + " nodes ");
        for(var i = Math.min(num, 2); i > 0; i--) 
            await P2PNetwork.connectNode(); 
        console.log("connected", P2PNetwork.connected);     
        //P2PNetwork.startConnectTimer();
        var dataCache = Utils.getStreamDataCache();
        dataCache.onUpdateUser = (community, user, role, titles)=>{
            this.server.to(community).emit("u", ["r", community, user, role, titles]);
        };
        dataCache.onUserJoin = (community, user, joined) =>{
            this.server.to(community).emit("u", ["j", community, user, joined]);
        };
        dataCache.onUpdateCommunity = (community)=>{
            this.server.to(community).emit("u", ["u", community]);
        };
    }
    
    async syncUserPreferences(node: NodeInfo, fromTime: number = 0): Promise<any> {
        console.log("start syncUserPreferences:");
        var lastTime = fromTime;  
        var lastUser = "";      
        var limit = 100;
        var updateCount = 0;
        while(true) {
            var result = await node.readPreferences(lastTime, lastUser, limit);
            if(result[0]) {
                var array = result[1];
                for(var data of array) {
                    var signableMessage = SignableMessage.fromJSON(data);
                    var timestamp = signableMessage.getTimestamp();
                    try {
                        if(signableMessage.isPreference()) {
                            var databaseResult = await Database.write(signableMessage);
                            if(databaseResult[0]) {
                                updateCount++;
                            }
                        }
                    }
                    catch(e) { console.log(e); }
                    if(timestamp === lastTime) lastUser = signableMessage.getUser();
                    else if(timestamp > lastTime) {
                        lastTime = timestamp;
                        lastUser = signableMessage.getUser();
                    }
                }
                if(array.length < limit) {
                    console.log("syncUserPreferences ended, updated: ", updateCount, " entries.");
                    var checkSum = result[2];
                    if(Database.preferencesChecksum().matches(checkSum)) {
                        return true;
                    }
                    break;
                }
            }
            else {
                console.log("failed to retrieve user preferences", result[1]);
                break;
            }
        }
        return false;
    }
    async syncMessages(node: NodeInfo, fromTime: number = 0): Promise<any> {
        console.log("start syncMessages:");
        var lastTime = fromTime;  
        var lastId = -1;      
        var limit = 100;
        var updateCount = 0;
        while(true) {
            var result = await node.readMessages(lastTime, lastId, limit);
            if(result[0]) {
                var array = result[1];
                for(var data of array) {
                    var signableMessage = SignableMessage.fromJSON(data);
                    var timestamp = signableMessage.getTimestamp();
                    try {
                        if(!signableMessage.isPreference()) {
                            var databaseResult = await Database.writeMessage(signableMessage, false);
                            if(databaseResult[0]) {
                                updateCount++;
                            }
                        }
                    }
                    catch(e) { console.log(e); }
                    if(timestamp > lastTime) lastTime = timestamp;
                }
                if(array.length > 0) { lastId = result[2]; }
                if(array.length < limit) {
                    console.log("syncMessages ended, updated: ", updateCount, " entries.");
                    var checkSum = result[2];
                    if(Database.preferencesChecksum().matches(checkSum)) {
                        return true;
                    }
                    break;
                }
            }
            else {
                console.log("failed to retrieve messages", result[1]);
                break;
            }
        }
        return true;
    }

    async sync(fromTime: number): Promise<any> {
        var currentChecksum = Database.preferencesChecksum();
        //1. find nodes to read data from
        var connected = P2PNetwork.connected;
        for(var url in connected) {
            var info = connected[url];
            if(info.isConnected()) {
                var isSuccess = await this.syncUserPreferences(info,
                     currentChecksum.time-2*MAX_TIME_DIFFERENCE);
                console.log("sync preferences: ", info.url, " ", isSuccess);
                if(isSuccess) break;
            }
        }
        //2. read message data
        var loadMessagesFromTime = 0;
        try {
            var latestMessage = await Database.readLatest();
            if(latestMessage) loadMessagesFromTime = latestMessage.toTimestamp()-2*MAX_TIME_DIFFERENCE;
        }
        catch(e) { console.log(e); }
        for(var url in connected) {
            var info = connected[url];
            if(info.isConnected()) {
                await this.syncMessages(info, loadMessagesFromTime);
                console.log("sync preferences: ", info.url, " ");
                break;
            }
        } 

        return "ok";
    }

    @SubscribeMessage('r')
	async onRead(client: Socket, data: any): Promise<any> {
        return await NetMethods.read(data);
    }

    @SubscribeMessage('rm')
	async onReadMessages(client: Socket, data: any): Promise<any> {
        return await NetMethods.readMessages(data[1], data[2], data[3]);
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
            else {
                this.server.to(signableMessage.getConversation())
                    .emit("w", data);
                if(signableMessage.isCommunityConversation())
                    this.stats.add(signableMessage.getConversationUsername(), signableMessage.getTimestamp());
            }
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

    @SubscribeMessage('s')
	async onStatsRequest(client: Socket, data: string): Promise<any[]> {
        return [true, this.stats.data];
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

