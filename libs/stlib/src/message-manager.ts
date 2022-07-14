import { Client, CallbackResult } from './client'
import { Utils } from './utils'
import { SignableMessage } from './signable-message'
import { DisplayableMessage } from './displayable-message'

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
    private loginmethod: LoginMethod
    
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
            this.client.onmessage = function(json) {
		        var onmessage = _this.onmessage;
                if(onmessage != null) onmessage(json);
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
            
        }
        this.user = user;
        var client = this.getClient();
        client.join(user);
    }
    setUseKeychain() { this.loginmethod = new LoginWithKeychain(); }
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
        
        var displayableMessage = new DisplayableMessage(msg);
        displayableMessage.content = content;
        displayableMessage.verified = verified;
        displayableMessage.init();
        return displayableMessage;
    } 
}
