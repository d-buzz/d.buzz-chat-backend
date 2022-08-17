import { Client, CallbackResult } from './client'
import { Utils, AccountDataCache } from './utils'
import { SignableMessage } from './signable-message'
import { DisplayableMessage } from './displayable-message'
import { JSONContent, Content, Edit, Encoded, Preferences,
         PrivatePreferences, WithReference } from './content/imports'

declare var io: any;
declare var window: any;

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

    keys: any = {}
    keychainPromise: Promise<any> = null
    
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
                if(data != null) {
                    data.messages.push(displayableMessage);
                    _this.resolveReference(data.messages, displayableMessage);
                }
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
    async getPrivatePreferences(): Promise<PrivatePreferences> {
        var p = await this.getPreferences();
        if(this.keychainPromise != null) await this.keychainPromise;
        var promise = p.getPrivatePreferencesWithKeychain(this.user);
        this.keychainPromise = promise;
        return await promise; 
    }
    async storeKeyLocallyEncryptedWithKeychain(group: string, key: string) {
        var encodedText = await Content.encodeTextWithKeychain(this.user, key, 'Posting');
        window.localStorage.setItem(this.user+"|"+group, encodedText);
        var keys = this.keys;
        keys[group] = key;
    }
    async getKeyFor(group: string): Promise<string> {
        var keys = this.keys;
        if(keys[group] != null) return keys[group];
        var pref = await this.getPrivatePreferences();
        var key = pref.getKeyFor(group);
        if(key === null) {
            var text = window.localStorage.getItem(this.user+"|"+group); 
            if(text != null) {
                keys[group] = key = await Content.decodeTextWithKeychain(this.user, text);
            }
        }
        return key;
    }
    async updatePreferences(preferences: Preferences): Promise<CallbackResult>  {
        if(this.user == null) return null;

        await preferences.encodePrivatePreferencsWithKeychan(this.user);
        var signableMessage = preferences.forUser(this.user);
        await signableMessage.signWithKeychain('Posting');

        var client = this.getClient();
        return await client.write(signableMessage);
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
                    _this.resolveReferences(messages);
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
        var messages = await this.toDisplayable(result);
        this.resolveReferences(messages);
        return messages;
    }
    async sendMessage(msg: JSONContent, conversation: any,
        keychainKeyType: string = 'Posting'): Promise<CallbackResult> {
        var user = this.user;
        if(user === null) return null; 
        var client = this.getClient();

        var encodeKey = null;
        if(Array.isArray(conversation) || conversation.indexOf('|') !== -1) 
            msg = await msg.encodeWithKeychain(user, conversation, keychainKeyType); 
        else if(conversation.startsWith('#')) { //Group Message
            encodeKey = await this.getKeyFor(conversation);
            if(encodeKey === null) {
                console.log("unknown key"); //TODO ask to enter key
                return;
            }
        } 
        var signableMessage = msg.forUser(user, conversation);
        await signableMessage.signWithKeychain(keychainKeyType);
        if(encodeKey !== null) signableMessage.encodeWithKey(encodeKey);
        return await client.write(signableMessage);
    }
    resolveReferences(messages: DisplayableMessage[]) {
        for(var msg of messages) this.resolveReference(messages, msg);
    }
    resolveReference(messages: DisplayableMessage[], msg: DisplayableMessage) {
        try {
            var content = msg.content;
            if(content instanceof WithReference) {
                var ref = content.getReference().split('|');
                var user = ref[0];
                var time = Number(ref[1]);
                for(var m of messages) {
                    if(m.getUser() == user && m.getTimestamp() == time) {
                        if(content instanceof Edit) {
                            if(msg.getUser() == user) 
                                m.edit(msg);
                        }
                        else msg.reference = m;
                        return;
                    }
                }
                console.log("did not find reference ", content.getReference());
            }
        }
        catch(e) {
            console.log("error resolving reference ", msg, e);
        }
    }
    async toDisplayable(result: CallbackResult): Promise<DisplayableMessage[]> {
        var list: DisplayableMessage[] = [];
        var array = result.getResult();
        for(var msgJSON of array) {
            try {
                list.push(await this.jsonToDisplayable(msgJSON));
            }
            catch(e) {
                console.log("Error reading message: ", msgJSON);
                console.log(e);
            }
        }
        return list;
    }
    async jsonToDisplayable(msgJSON: any): Promise<DisplayableMessage> {
        var msg = SignableMessage.fromJSON(msgJSON);

        if(msg.isSignedWithGroupKey()) {
            var key = await this.getKeyFor(msg.getConversation());
            if(key === null) throw 'key not found';
            msg.decodeWithKey(key);
        }
            
        var verified = await msg.verify();
        var content = msg.getContent();

        if(content instanceof Encoded) {
            var decoded = await content.decodeWithKeychain(this.user, msg.getGroupUsernames());
            content = decoded;
        }
        
        var displayableMessage = new DisplayableMessage(msg);
        if(content instanceof Edit) {
            var editContent = content.getEdit();
            displayableMessage.editContent = (editContent == null)?null:Content.fromJSON(editContent);
            displayableMessage.isEdit = true;
        }
        displayableMessage.content = content;
        displayableMessage.verified = verified;
        displayableMessage.init();
        return displayableMessage;
    } 
}