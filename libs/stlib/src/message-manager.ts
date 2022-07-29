import { Client, CallbackResult } from './client'
import { Utils, AccountDataCache } from './utils'
import { SignableMessage } from './signable-message'
import { DisplayableMessage } from './displayable-message'
import { Content, Encoded, Preferences } from './content/imports'

declare var io: any;

export class LoginMethod {
    
}
export class LoginWithKeychain extends LoginMethod {

}
export class MessageManager {
    socket: any
    client: Client
    connectionStart: boolean
    nodeIndex: number
    nodes: string[]   
    onmessage: any 
    user: string
    userPreferences: Preferences = null

    private loginmethod: LoginMethod

    joined: any = {}
    cachedUserMessages: DisplayableMessage[] = null

    selectedConversation: string = null
    conversations: AccountDataCache = new AccountDataCache()
    
    defaultReadHistoryMS: number
    constructor() {
        this.defaultReadHistoryMS = 30*24*60*60000; 
    }
    setNodes(nodes: string[]) {
        for(var i = 0; i < nodes.length; i++)
            nodes[i] = nodes[i].replace(/^http/, 'ws');
        this.nodes = nodes;
        this.connectionStart = true;
        this.nodeIndex = 0;
        this.connect();
    }
    connect() {
        var _this = this;
        //navigator.onLine 
        if(this.nodeIndex >= this.nodes.length) {
            if(this.connectionStart) {
                console.log("count not connect to any node");
                return;
            }
            else this.nodeIndex = 0;
        }
        try {
            let socket = io(this.nodes[this.nodeIndex], {
                transports:["websocket", "polling"]                    
            });
            socket.on("connect_error", (err) => {
                console.log(`connect_error ${err.message}`);
                socket.disconnect();
                this.nodeIndex = this.nodeIndex+1;
                this.connect();
            });
            socket.on('disconnect', function() {
                console.log("disconnected ");
            });
                 
            this.client = new Client(socket);
            this.client.onmessage = async function(json) {
		        var onmessage = _this.onmessage;
                var displayableMessage = await _this.jsonToDisplayable(json);
                var data = _this.conversations.lookupValue(
                                displayableMessage.getConversation());
                if(data != null) data.messages.push(displayableMessage);
                if(onmessage != null) onmessage(displayableMessage);
	        };
            Utils.setClient(this.client);
            
            this.connectionStart = false;
            console.log("connected to " + this.nodes[this.nodeIndex]);
            return;            
        }
        catch(e) {
            console.log("connect error");
            console.log(e);
        }
    }
    getClient(): Client { return this.client; }
    setUser(user: string) {
        if(this.user == user) return;
        if(this.user != null) {
            this.userPreferences = null;
        }
        this.user = user;
        this.join(user);
    }
    async getPreferences(): Promise<Preferences> {
        var p = this.userPreferences;
        if(p != null) return p;
        if(this.user == null) return null;
        p = await Utils.getAccountPreferences(this.user);
        if(p === null) p = Content.preferences();     
        this.userPreferences = p;
        return p;
    }
    join(room: string) {
        if(room == null) return;
        if(room.indexOf('|') != -1) return;
        if(this.joined[room]) return;
        this.joined[room] = true;
        var client = this.getClient();
        client.join(room);
    }
    setUseKeychain() { this.loginmethod = new LoginWithKeychain(); }
    setConversation(username: string) {
        this.selectedConversation = username;
        this.join(username);
    }
    async getSelectedConversations(): Promise<any> {
        var conversation = this.selectedConversation;
        if(conversation == null) return null;
        var isPrivate = conversation.indexOf('|') !== -1;
       
        var _this = this;
        return await this.conversations.cacheLogic(
            conversation, (conversation)=>{
            var client = _this.getClient();
            var timeNow = Utils.utcTime();
            var promise = null;
            if(isPrivate) {
                if(this.cachedUserMessages == null) {
                    promise = _this.readUserMessages().then((result)=>{
                        this.cachedUserMessages = result;
                        return result;
                    });
                }
                else promise = Promise.resolve(this.cachedUserMessages);
                promise = promise.then((allMessages)=>{
                    var messages = allMessages.filter(
                        (m)=>m.getConversation()===conversation);
                    return {messages};
                })
            }
            else {
                promise = client.read(conversation, 
                 timeNow-_this.defaultReadHistoryMS,
                 timeNow+600000).then((result)=>{
                if(!result.isSuccess()) throw result.getError();
                    return _this.toDisplayable(result);
                }).then((messages)=>{
                    return {messages};
                });
            }
            return promise;
        });
    }

    async readUserConversations(): Promise<any> {
        var user = this.user;
        if(user === null) return [];  
        var client = this.getClient();
        var result = await client.readUserConversations(user);
        if(!result.isSuccess()) throw result.getError();
        return result.getResult();
    }

    async readUserMessages(): Promise<DisplayableMessage[]> {
        var user = this.user;
        if(user === null) return [];        
        var client = this.getClient();
        var timeNow = Utils.utcTime();
        var result = await client.readUserMessages(user, timeNow-this.defaultReadHistoryMS,
             timeNow+600000);
        if(!result.isSuccess()) throw result.getError();
        return await this.toDisplayable(result);
    }

    async toDisplayable(result: CallbackResult): Promise<DisplayableMessage[]> {
        var list: DisplayableMessage[] = [];
        var array = result.getResult();
        for(var msgJSON of array) 
            list.push(await this.jsonToDisplayable(msgJSON));
        return list;
    }
    async jsonToDisplayable(msgJSON: any): Promise<DisplayableMessage> {
        var msg = SignableMessage.fromJSON(msgJSON);
            
        var verified = await msg.verify();
        var content = msg.getContent();

        if(content instanceof Encoded) {
            var decoded = await content.decodeWithKeychain(this.user, msg.getGroupUsernames());
            content = decoded;
        }
        
        var displayableMessage = new DisplayableMessage(msg);
        displayableMessage.content = content;
        displayableMessage.verified = verified;
        displayableMessage.init();
        return displayableMessage;
    } 
}
