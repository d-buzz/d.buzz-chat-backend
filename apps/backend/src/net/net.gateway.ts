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
import { NodeSetup, NodeMethods } from "../data-source"
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
/*
    Automatically perform sync every x milliseconds.
    Set to 0 or negative value to disable.
*/
const AUTO_SYNC_INTERVAL = 30*60*1000; //30 minutes
/*
    Sync history of at most x milliseconds.
*/
const AUTO_SYNC_DEPTH = 24*60*60*1000; //1 day

@WebSocketGateway({ 
    cors: {origin: '*'}, transports: ['websocket', 'polling']  })
export class NetGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server;

    stats: MessageStats

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
        var _this = this;
        NetMethods.initialize(async (data)=>{
            return await _this.onAccount(null, data);
        }, async (data)=>{
            return await _this.onWrite(null, data);
        }, ()=>{
            return _this.connectedNodes();
        }, ()=>{ return [true, _this.stats.data] },
           (time: number)=>{ return _this.sync(time); });
        Utils.setNode(true);
        Utils.setReadPreferenceFunction(async (user)=>{
            var result = await NetMethods.readPreference(user);
            if(result[0] && result[1]) 
                return Content.fromJSON(JSON.parse(result[1][3])); 
            return null;
        });
        var dataCache = Utils.getStreamDataCache();
        dataCache.begin();

        this.stats = new MessageStats(7);
    }    

    async afterInit(socket: Socket): Promise<void> {
        P2PNetwork.initialize(this);
        var time = Utils.utcTime();
        await Database.initialize();
        await Database.readStats(this.stats, time-86400000*this.stats.days, time);
        var num = await P2PNetwork.loadNodes(NodeSetup.nodes);
        console.log("loaded " + num + " nodes ");
        for(var i = Math.min(num, 2); i > 0; i--) 
            await P2PNetwork.connectNode(); 
        console.log("connected", P2PNetwork.connected); 
        try { this.sync(); }
        catch(e) { console.log(e); }
        //start sync timer
        var _this = this;
        if(AUTO_SYNC_INTERVAL > 0) {
            setInterval(async ()=> {
                try { await _this.sync(Utils.utcTime()-AUTO_SYNC_DEPTH); }
                catch(e) { console.log(e); }
            }, AUTO_SYNC_INTERVAL);
        }
        P2PNetwork.startConnectTimer();
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
    async syncMessages(node: NodeInfo, fromTime: number = 0, toTime: number = -1): Promise<number> {
        console.log("start syncMessages: ", node.url, fromTime, toTime);
        var lastTime = fromTime;  
        var lastId = -1;      
        var limit = 100;
        var updateCount = 0;
        while(true) {
            if(toTime !== -1 && lastTime >= toTime) break;
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
                    //console.log("syncMessages ended, updated: ", updateCount, " entries.");
                    break;
                }
            }
            else {
                console.log("failed to retrieve messages", result[1]);
                break;
            }
        }
        return updateCount;
    }

    async sync(fromTime: number = null): Promise<any> {
        console.log("start sync:");
        var currentChecksum = Database.preferencesChecksum();
        var loadPreferencesFromTime = fromTime === null?(currentChecksum.time-2*MAX_TIME_DIFFERENCE):fromTime;
        //1. find nodes to read data from
        var connected = P2PNetwork.connected;
        for(var url in connected) {
            var info = connected[url];
            if(info.isConnected()) {
                var isSuccess = await this.syncUserPreferences(info, loadPreferencesFromTime);
                console.log("sync preferences: ", info.url, " ", isSuccess);
                if(isSuccess) break;
            }
        }
        //2. read message data
        var loadMessagesFromTime = 0;
        if(fromTime === null) {
            try {
                var latestMessage = await Database.readLatest();
                if(latestMessage) loadMessagesFromTime = latestMessage.toTimestamp()-2*MAX_TIME_DIFFERENCE;
            }
            catch(e) { console.log(e); }
        }
        else loadMessagesFromTime = fromTime;
        for(var url in connected) {
            var info = connected[url];
            if(info.isConnected()) {
                await this.syncMessages(info, loadMessagesFromTime);
                console.log("sync messages: ", info.url, " ");
                break;
            }
        }
        //3. load message checksum from other nodes
        var infos = [];
        for(var url in connected) {
            var node = connected[url];
            if(node.isConnected()) {
                try {                
                    var _info = await node.readInfo();
                    if(_info[0]) {
                        var result = _info[1];
                        var checksum = result.messagesChecksum;
                        infos.push([node, checksum]);
                    }
                }
                catch(e) { console.log(e); }
            }
        }
        if(infos.length > 0) {
            //for all 1-hour message checksum bins, or from specified fromTime       
            var checksumCache = Database.messagesChecksumCache();
            var checkFromTime = checksumCache.binTime(((fromTime != null)?fromTime:Utils.utcTime())-checksumCache.duration);      
            var checkToTime = checksumCache.binTime(Utils.utcTime())+checksumCache.binDuration;
            for(var i = checkFromTime; i <= checkToTime; i += checksumCache.binDuration) {
                var checksumI = checksumCache.items[i];

                var checksumResult = new MessageChecksumResult();
                for(var info2 of infos) checksumResult.add(checksumI, info2);

                if(checksumResult.actionRequired()) {
                    if(checksumResult.hasMissing()) {
                        //sync with the nodes
                        for(var missingInfo of checksumResult.missing) {
                            if(checksumResult.isMissing(checksumI,missingInfo)) {
                                var updatedItems = await this.syncMessages(missingInfo[0], i, i+checksumCache.binDuration);
                                console.log("sync found ", updatedItems, " missing messages.");                                
                                checksumI = checksumCache.items[i];
                            }
                        }
                    }
                    /*
                    //other nodes have missing message could ping them to let them know 
                    //or they can find out on their next sync
                    if(checksumResult.otherNode.length > 0) {
                           
                    }
                    */
                }
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

    @SubscribeMessage('rg')
	async onReadCommunity(client: Socket, data: any): Promise<any> {
        return await NetMethods.readCommunity(data);
    }

    @SubscribeMessage('a')
	async onAccount(client: Socket, data: string): Promise<any[]> {
        if(!NodeMethods.canCreateGuestAccount()) return [false, 'this node does not create accounts.'];
        var signableMessage = SignableMessage.fromJSON(data);
        var accountName = signableMessage.getUser();
        if(!Utils.isValidGuestName(accountName)) return [false, 'invalid account name.'];
        var userNumber = Utils.parseGuest(accountName);
        if(userNumber.length == 2 && Database.isGuestAccountAvailable(accountName)) {}
        else accountName = await Database.findUnusedGuestAccount(userNumber[0]);
        if(!accountName) return [false, 'account name unavailable.'];
       
        var isCached = await this.cacheManager.get(accountName);
        if(isCached) {
            var _this = this;
            accountName = await Database.findUnusedGuestAccount(userNumber[0], 
                async (a)=>{
                    var isUsed = await _this.cacheManager.get(a); 
                    return !(isUsed===true);
                });
            if(!accountName) return [false, 'account name unavailable.'];
        }

        await this.cacheManager.set(accountName, true, {ttl: MIN_CACHE_SECONDS});
        
        signableMessage.setUser(accountName);
        var message = NodeMethods.createGuestAccount(signableMessage);
        if(message) return [true, message.toArray()];
        return [false, 'failed to create account.'];
    }

    @SubscribeMessage('w')
	async onWrite(client: Socket, data: string): Promise<any[]> {
        var signableMessage = SignableMessage.fromJSON(data);
        var type = signableMessage.getMessageType();
        if(type !== SignableMessage.TYPE_WRITE_MESSAGE &&
             type !== SignableMessage.TYPE_MESSAGE)
            return [false, "error: unsupported message type: '" + type + "'"];
        //Check the time difference
        //TODO a single node might accept a msg on last second
        //then pass it to other nodes too late. fix
	    if(Math.abs(signableMessage.getTimestamp()-Utils.utcTime()) 
            > MAX_TIME_DIFFERENCE) { //5mins
		    return [false, "error: Timestamp too different from current time."];
	    }
        //was message was already received by another node?
        var isCached = await this.cacheManager.get(data);
        if(isCached) return [false, "warning: already received."];

        var writeToDB = type === SignableMessage.TYPE_WRITE_MESSAGE;
        if(writeToDB) { //Write to database (SignableMessage.TYPE_WRITE_MESSAGE)
            var databaseResult = await Database.write(signableMessage);
            if(!databaseResult[0]) return databaseResult;
        }
        else { //Without writing to database (SignableMessage.TYPE_MESSAGE)
            var verifyResult = await signableMessage.verify();
            if(verifyResult) verifyResult = await signableMessage.verifyPermissions();
            else return [false, 'message did not verify.'];
            if(!verifyResult) return [false, 'permission.'];
        }
        //on sucess cache
        await this.cacheManager.set(data, true,
             {ttl: MIN_CACHE_SECONDS});
        //send to all other nodes
        this.server.to("#nodes").emit("w", data);
        await P2PNetwork.write(data);
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
            if(signableMessage.isOnlineStatus()) 
                NetMethods.setOnlineStatus(signableMessage);
            else if(writeToDB && signableMessage.isCommunityConversation())
                this.stats.add(signableMessage.getConversationUsername(), signableMessage.getTimestamp());
        }
        return ["true", null];
    }

    @SubscribeMessage('n')
	async onNewNode(client: Socket, data: any): Promise<any[]> {
        var name = data.name;
        if(name !== NodeSetup.name) return [false, 
            'different network ' + NodeSetup.name + ' != ' + name];
        var user = data.account;
        var host = data.host;
        //var path = user+':'+host;
        //var id = client.id;

        var client0: any = client;
        client0._data = { user, host };
        client.join("#nodes");

        P2PNetwork.addNode(host);

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
class MessageChecksumResult {
    missing: any[] = []
    otherNode: any[] = []
    actionRequired(): boolean {
        return this.missing.length+this.otherNode.length > 0;
    }
    hasMissing(): boolean { return this.missing.length > 0; }
    add(checksum, info) {
        var result = this.isMissing(checksum, info);
        switch(result) {
            case 0: this.otherNodeIsMissing(info); break;
            case 1: this.unlikelyMissing(info); break;
            case 2: this.foundMissing(info); break;
        }
    }
    isMissing(checksum, info): number {
        var nodeChecksum = info[1];
        if(checksum == null) {
            //found missing messages
            if(nodeChecksum != null && nodeChecksum.count > 0) return 2;
        }
        else {
            if(nodeChecksum == null) {
                //the other node has missing messages
                //we could ping it to tell it that
                return 0;
            }
            else {
                if(!checksum.matches(nodeChecksum)) {
                    if(checksum.time < nodeChecksum.time || 
                        checksum.count < nodeChecksum.count) {
                        //found missing messages
                        return 2;
                    }
                    else {
                        //most likely the other node is missing messages
                        //it might be this node too
                        return 1;
                    }
                }
            }
        }
        return -1;
    }

    foundMissing(info) {
        this.missing.push(info);
    }
    otherNodeIsMissing(info) {
        this.otherNode.push(info);
    }
    unlikelyMissing(info) {
        this.missing.push(info);
    }
}






