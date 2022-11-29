import { Client, CallbackResult } from './client'
import { Utils, AccountDataCache } from './utils'
import { SignableMessage } from './signable-message'
import { DisplayableMessage } from './displayable-message'
import { JSONContent, Content, Edit, Emote, Encoded, Preferences,
         PrivatePreferences, Thread, WithReference } from './content/imports'

declare var dhive: any;
declare var hive: any;
declare var io: any;
declare var window: any;

export interface LoginMethod {
    decodePrivatePreferences(preferences: Preferences): Promise<PrivatePreferences>;
    encodePrivatePreferences(preferences: Preferences);
    encodeContent(content: JSONContent, user: string,
         groupUsers: string[], keychainKeyType: string): Promise<Encoded>;
    signMessage(message: SignableMessage, keychainKeyType: string): Promise<SignableMessage>;
}
export class LoginKey implements LoginMethod {
    user: string
    key: any
    publickey: any
    keystring: string
    publickeystring: string
    constructor(user: string, key: string) {
        this.user = user;
        this.key = dhive.PrivateKey.fromString(key);
        this.publickey = this.key.createPublic('STM');
        this.keystring = key;
        this.publickeystring = this.publickey.toString();
    }
    async decodePrivatePreferences(preferences: Preferences): Promise<PrivatePreferences> {
        return preferences.getPrivatePreferencesWithKey(this.keystring);
    }
    encodePrivatePreferences(preferences: Preferences) {
        preferences.encodePrivatePreferencesWithKey(this.keystring, this.publickeystring);
    }
    async encodeContent(content: JSONContent, user: string,
         groupUsers: string[], keychainKeyType: string): Promise<Encoded> {
        return await content.encodeWithKey(user, groupUsers, keychainKeyType, this.keystring);
    }
    async signMessage(message: SignableMessage, keychainKeyType: string): Promise<SignableMessage> {
        return message.signWithKey(this.key, keychainKeyType);
    }
}
export class LoginWithKeychain implements LoginMethod {
    user: string
    constructor(user: string) {
        this.user = user;
    }
    async decodePrivatePreferences(preferences: Preferences): Promise<PrivatePreferences> {
        return await preferences.getPrivatePreferencesWithKeychain(this.user);
    }
    async encodePrivatePreferences(preferences: Preferences) {
        await preferences.encodePrivatePreferencesWithKeychan(this.user);
    }
    async encodeContent(content: JSONContent, user: string,
         groupUsers: string[], keychainKeyType: string): Promise<Encoded> {
        return await content.encodeWithKeychain(user, groupUsers, keychainKeyType);
    }
    async signMessage(message: SignableMessage, keychainKeyType: string): Promise<SignableMessage> {
        return await message.signWithKeychain(keychainKeyType);
    }
}
export class EventQueue {
    callbacks: any = {} 
    set(name: string, callback: any = null) {
        if(callback == null) delete this.callbacks[name];
        else this.callbacks[name] = callback;
    }
    post(message: any) {
        var callbacks = this.callbacks;
        for(var callbackName in callbacks) {
            try {
                callbacks[callbackName](message);
            }
            catch(e) {
                console.log(callbackName, e);
            }
        }
    }
}
export class MessageManager {
    socket: any
    client: Client
    connectionStart: boolean
    nodeIndex: number
    nodes: string[]   
    user: string
    userPreferences: Preferences = null

    onmessage: EventQueue = new EventQueue()
    onpreferences: EventQueue = new EventQueue()

    private loginmethod: LoginMethod

    joined: any = {}
    cachedUserMessages: DisplayableMessage[] = null
    cachedUserMessagesLoadedAll: boolean = false
    cachedUserConversations: string[] = null
    recentlySentEncodedContent: any = []
    
    conversationsLastReadData = {}
    selectedCommunityPage: any = {}
    selectedConversation: string = null
    conversations: AccountDataCache = new AccountDataCache()
    communities: AccountDataCache = new AccountDataCache()

    cachedGuestData = null

    keys: any = {}
    keychainPromise: Promise<any> = null
    
    defaultReadHistoryMS: number
    pauseAutoDecode: boolean = false
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
    setCallback(name: string, callback: any) {
        this.onmessage.set(name, callback);
    }
    postCallbackEvent(displayableMessage: DisplayableMessage) {
        this.onmessage.post(displayableMessage);
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
            this.client.onupdate = function(data) {
                console.log("update", data);
            }; 
            this.client.onmessage = async function(json) {
                var displayableMessage = await _this.jsonToDisplayable(json);
                var conversation = displayableMessage.getConversation();
                var lastRead = _this.conversationsLastReadData[conversation];
                if(lastRead == null) {
                    lastRead = { number: 0, timestamp: 0 };
                    _this.conversationsLastReadData[conversation] = lastRead;
                }
                if(_this.selectedConversation === conversation) 
                    _this.setLastRead(conversation, displayableMessage.getTimestamp());
                else if(displayableMessage.getTimestamp() > lastRead.timestamp) {
                    lastRead.number++;
                    window.localStorage.setItem(_this.user+"#lastReadData", 
                        JSON.stringify(_this.conversationsLastReadData));
                }
                var data = _this.conversations.lookupValue(
                                displayableMessage.getConversation());
                if(data == null && conversation.indexOf('|') !== -1) {
                    data = await _this.getSelectedConversations(conversation);
                    if(_this.cachedUserConversations != null && 
                        _this.cachedUserConversations.indexOf(conversation) === -1)
                        _this.cachedUserConversations.unshift(conversation);
                    if(data != null && (_this.hasMessage(data.encoded, displayableMessage) || 
                        _this.hasMessage(data.messages, displayableMessage))) 
                        data = null;
                }
    
                if(data != null) {
                    if(data.encoded != null && displayableMessage.isEncoded()) {
                        var prefs = await _this.getPreferences();
                        if(!_this.pauseAutoDecode && prefs.getValueBoolean("autoDecode", false) === true) {
                            try {
                                var decodedMessage = await _this.decode(displayableMessage);
                                data.messages.push(decodedMessage);
                                _this.resolveReference(data.messages, decodedMessage);
                            }
                            catch(e) {
                                data.encoded.push(displayableMessage);
                                if(e.success !== undefined && e.success === false) {
                                    if(e.error === "user_cancel") return;
                                }
                            }   
                        }
                        else data.encoded.push(displayableMessage);
                    }
                    else {
                        data.messages.push(displayableMessage);
                        _this.resolveReference(data.messages, displayableMessage);
                    }
                }
                _this.postCallbackEvent(displayableMessage);
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
            this.cachedUserConversations = null;
        }
        this.user = user;
        try {
            var lastReadData = window.localStorage.getItem(user+"#lastReadData");
            if(lastReadData != null)
                this.conversationsLastReadData = JSON.parse(lastReadData);
        }
        catch(e) { console.log(e); }
        this.join(user);
    }
    readGuest(username: string): string[] {
        var guests = this.readGuests();
        if(guests[username] !== undefined) return [username, guests[username]];
        username = Utils.parseGuest(username)[0];
        for(var name in guests)
            if(username === Utils.parseGuest(name)[0])
                return [name, guests[name]];
        return null;
    } 
    readGuests(): any {
        if(this.cachedGuestData != null) return this.cachedGuestData;
        var guestData = window.localStorage.getItem("#guestdata");
        var obj = (guestData == null)?{}:JSON.parse(guestData);
        this.cachedGuestData = obj;
        return obj;
    }
    storeGuestLocally(user: string, key: string) {
        var guestData = this.readGuests();
        guestData[user] = key;
        window.localStorage.setItem("#guestdata", JSON.stringify(guestData));
    }
    async createGuestAccount(username: string, publicPostingKey: string = null,
        storePrivateKeyLocally: string = null): Promise<CallbackResult> {
        var client = this.getClient();
        if(!Utils.isValidGuestName(username)) return new CallbackResult(false, 'username is not valid.');
        if(publicPostingKey == null) {
            var piKey = dhive.PrivateKey.fromLogin(username,
                hive.formatter.createSuggestedPassword()+Math.random(),"posting"); 
            publicPostingKey = piKey.createPublic("STM").toString();
            storePrivateKeyLocally = piKey.toString();
        }
        try {
            var result = await client.createGuestAccount(username, publicPostingKey);
            if(!result.isSuccess()) return result;
            var message = result.getResult();
            var guestUsername = message[2];
            if(publicPostingKey !== message[3]) return new CallbackResult(false, 'error creating account.');
            
            var preferences = Content.preferences();
            preferences.createGuestAccount(message);
            var signableMessage = preferences.forUser(guestUsername);
            signableMessage.signWithKey(storePrivateKeyLocally,'@');
            var finalResult = await client.write(signableMessage);
            if(finalResult.isSuccess()) {
                this.storeGuestLocally(guestUsername, storePrivateKeyLocally);
                return new CallbackResult(true, guestUsername);
            }
            return finalResult;
        }
        catch(e) {
            console.log(e);
        }
        return new CallbackResult(false, 'error creating account.');
    }
    async joinGroups() {
        var groups = await this.getJoinedAndCreatedGroups();
        for(var conversation in groups)
           this.join(conversation);
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
        var promise = this.loginmethod.decodePrivatePreferences(p);
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
    async closeGroup(group: string) {
        var pref = await this.getPreferences();
        await this.loginmethod.decodePrivatePreferences(pref);
        
        pref = pref.copy();
        var privatePref = pref.privatePreferences;
    
        privatePref.setKeyFor(group, null);
        var updateRequired = privatePref.updated;
        var groupConversation = Utils.parseGroupConversation(group);
        if(groupConversation != null) {
            var username = groupConversation[1];
            var id = groupConversation[2];
            if(username === this.user) {
                if(pref.getGroup(id) != null) {
                    pref.setGroup(id, null);
                    updateRequired = true;
                }
            }
        }
        if(updateRequired) await this.updatePreferences(pref);
    }
    async updatePreferences(preferences: Preferences): Promise<CallbackResult>  {
        if(this.user == null) return null;

        await this.loginmethod.encodePrivatePreferences(preferences);
        var signableMessage = preferences.forUser(this.user);
        await this.loginmethod.signMessage(signableMessage, 'Posting');

        var client = this.getClient();
        var result = await client.write(signableMessage);
        if(result.isSuccess()) {
            this.userPreferences = preferences;
            this.onpreferences.post(preferences);
        }
        return result;
    }
    join(room: string) {
        if(room == null) return;
        if(room.indexOf('|') != -1) return;
        if(this.joined[room]) return;
        this.joined[room] = true;
        var client = this.getClient();
        client.join(room);
    }
    setLogin(login: LoginMethod) { this.loginmethod = login; }
    setLoginKey(postingkey: string) { this.loginmethod = new LoginKey(this.user, postingkey); }
    setUseKeychain() { this.loginmethod = new LoginWithKeychain(this.user); }
    getSelectedCommunityPage(community: string, defaultPage: string = null) {
        var page = this.selectedCommunityPage[community];
        return page==null?defaultPage:page;
    }
    setSelectedCommunityPage(community: string, page: string) {
        this.selectedCommunityPage[community] = page;
    }
    setConversation(conversation: string) {
        this.selectedConversation = conversation;
        if(conversation != null) this.join(conversation);
    }
    async getCommunities(user: string = null): Promise<any> {
        if(user === null) user = this.user;
        if(user == null) return null;
        var _this = this;
        return await this.communities.cacheLogic(
            user, (user)=>{
            var promise = (Utils.isGuest(user))?Utils.getAccountPreferences(user).then(async (preferences)=>{
                var array = (preferences == null)?[]:preferences.getCommunities(); 
                var result = [];                
                for(var name of array) {
                    var data = await Utils.getCommunityData(name);
                    result.push([name, data.title, '', '']);
                }
                return result;               
            }):hive.api.callAsync("bridge.list_all_subscriptions", {"account":user});
            return promise.then(async (array)=>{
                var communityNames = [];
                for(var community of array)
                    communityNames.push(community[0]);
                if(communityNames.length > 0) {
                    await Utils.preloadAccountData(communityNames);
                    for(var community of array)
                        community.account = await Utils.getAccountData(community[0]);
                }
                return array;
            });
        });
    }
    async getJoinedAndCreatedGroups(): Promise<any> {
        var pref = await this.getPreferences();
        var privatePref = await this.getPrivatePreferences();
        var groups = {};
        var joinedGroup = privatePref.keys();
        for(var conversation in joinedGroup) {
            if(groups[conversation] !== undefined) continue;
            var groupConversation = Utils.parseGroupConversation(conversation);
            if(groupConversation == null) continue;
            var username = groupConversation[1];
            var id = groupConversation[2];
            groups[conversation] = {
                conversation, username, id, lastReadNumber: this.getLastReadNumber(conversation)
            };
        }
        for(var groupId in pref.getGroups()) {
            var conversation = '#'+this.user+'/'+groupId;
            if(groups[conversation] !== undefined) continue;
            groups[conversation] = {
                conversation, "username": this.user, "id":groupId, lastReadNumber: this.getLastReadNumber(conversation)
            };
        }
        return groups;
    }
    getLastReadNumber(conversation: string): any {
        var lastRead = this.conversationsLastReadData[conversation];
        return lastRead == null?0:lastRead.number;
    }
    getLastRead(conversation: string): any {
        var lastRead = this.conversationsLastReadData[conversation];
        return lastRead == null?null:lastRead;
    }
    setLastRead(conversation: string, timestamp: number): void {
        var lastRead = this.conversationsLastReadData[conversation];
        if(lastRead != null) {
            lastRead.number = 0;
            lastRead.timestamp = timestamp;
            window.localStorage.setItem(this.user+"#lastReadData", 
                        JSON.stringify(this.conversationsLastReadData));
        }
    }
    async getLastReadTotal(): Promise<number> {
        var numberOfPrivateMessages = await this.getLastReadOfUserConversations();
        var numberOfGroupMessages = await this.getLastReadOfGroupConversations();
        return numberOfPrivateMessages + numberOfGroupMessages;
    }
    async getLastReadOfGroupConversations(): Promise<number> {
        var groups = await this.getJoinedAndCreatedGroups();
        var number = 0;
        for(var conversation in groups)
            number += groups[conversation].lastReadNumber
        return number;
    }
    async getLastReadOfUserConversations(): Promise<number> {
        var conversations = await this.readUserConversations();
        var number = 0;
        for(var conversation of conversations) {
            var lastRead = this.getLastRead(conversation);
            if(lastRead != null)
                number += lastRead.number;
        }            
        return number;
    }
    async getLastReadCommunity(community: string): Promise<number> {
        var communityStreams = community+'/';
        var data = this.conversationsLastReadData;
        var number = 0;
        for(var conversation in data) {
            if(conversation === community || conversation.startsWith(communityStreams)) {
                var lastRead = data[conversation];
                if(lastRead != null)
                    number += lastRead.number;
            }
        }            
        return number;
    }
    async getPreviousConversations(conversation: string = this.selectedConversation): Promise<any> {
        if(conversation == null) return null;
        var data = await this.getSelectedConversations(conversation);
        if(data && data.maxTime > 0) {
            var client = this.getClient();
            var isPrivate = conversation.indexOf('|') !== -1;
            var promise = null;
            var timeNow = Utils.utcTime();
            var maxTime = timeNow+600000;
            for(var msg0 of data.messages)
                maxTime = Math.min(maxTime, msg0.getTimestamp());

            if(isPrivate) {
                for(var msg0 of data.encoded)
                    maxTime = Math.min(maxTime, msg0.getTimestamp());
                var result = await client.readUserMessages(this.user, 0, maxTime);
                if(!result.isSuccess()) throw result.getError();
                var messages = await this.toDisplayable(result);
                var added = 0;
                for(var msg of messages)
                    if(!this.hasMessage(this.cachedUserMessages, msg)) {
                        this.cachedUserMessages.push(msg);
                        added++;
                    }
                if(added > 0) {
                    this.resolveReferences(this.cachedUserMessages);
                    this.cachedUserMessages.sort((a,b)=>a.getTimestamp()-b.getTimestamp());
                    data.maxTime = maxTime;
                    this.postCallbackEvent(null);
                }
                else {
                    this.cachedUserMessagesLoadedAll = true;
                    data.maxTime = 0;
                }
                return data;
            }
            else {
                var result = await client.read(conversation, 0, maxTime);
                if(!result.isSuccess()) throw result.getError();
                var messages = await this.toDisplayable(result);
                var added = 0;
                for(var msg of messages) 
                    if(!this.hasMessage(data.messages, msg)) {
                        data.messages.push(msg);
                        added++;                    
                    }
                if(added > 0) {
                    await this.resolveReferences(data.messages);
                    data.messages.sort((a,b)=>a.getTimestamp()-b.getTimestamp());
                    data.maxTime = maxTime;
                    this.postCallbackEvent(null);
                }
                else {
                    data.maxTime = 0;
                }
            }
            return data;
        }
        return data==null?null:data;
    }
    async getSelectedConversations(conversation: string = this.selectedConversation): Promise<any> {
        if(conversation == null) return null;
        var isPrivate = conversation.indexOf('|') !== -1;
       
        var _this = this;
        return await this.conversations.cacheLogic(
            conversation, (conversation)=>{
            var client = _this.getClient();
            var timeNow = Utils.utcTime();
            var maxTime = timeNow+600000;
            var promise = null;
            if(isPrivate) {
                if(this.cachedUserMessages == null) {
                    promise = _this.readUserMessages().then((result)=>{
                        this.cachedUserMessages = result;
                        this.cachedUserMessagesLoadedAll = false;
                        return result;
                    });
                }
                else promise = Promise.resolve(this.cachedUserMessages);
                promise = promise.then((allMessages)=>{
                    var messages0 = allMessages.filter(
                        (m)=>m.getConversation()===conversation);
                    var messages = messages0.filter((m)=>!m.isEncoded());
                    var encoded = messages0.filter((m)=>m.isEncoded());
                    if(this.cachedUserMessagesLoadedAll) maxTime = 0;
                    return {messages, encoded, maxTime};
                })
            }
            else {
                promise = client.read(conversation, 0,  /*timeNow-_this.defaultReadHistoryMS; */ 
                       maxTime).then((result)=>{
                if(!result.isSuccess()) throw result.getError();
                    return _this.toDisplayable(result);
                }).then((messages)=>{
                    _this.resolveReferences(messages);
                    if(messages.length < 100) maxTime = 0;
                    return {messages, maxTime};
                });
            }
            return promise;
        });
    }
    async getThreads(): Promise<any> {
        var map = {};
        var data = await this.getSelectedConversations();
        if(!data || !data['messages']) return map;
        for(var msg of data['messages'])
            if(msg.isThread()) {
                var threadName = msg.getThreadName();
                if(map[threadName] === undefined) map[threadName] = [msg];                
                else map[threadName].push(msg);
            }
        return map;
    }
    async readUserConversations(): Promise<string[]> {
        var user = this.user;
        if(user === null) return [];  
        var conversations = this.cachedUserConversations;
        if(conversations != null) return conversations;
        var client = this.getClient();
        var result = await client.readUserConversations(user);
        if(!result.isSuccess()) throw result.getError();
        conversations = result.getResult();
        this.cachedUserConversations = conversations;
        return conversations;
    }

    async readUserMessages(): Promise<DisplayableMessage[]> {
        var user = this.user;
        if(user === null) return [];        
        var client = this.getClient();
        var timeNow = Utils.utcTime();
        var result = await client.readUserMessages(user, 0, /*timeNow-this.defaultReadHistoryMS,*/
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
        if(typeof conversation === 'string' && conversation.indexOf('|') !== -1)
            conversation = conversation.split('|');
        if(Array.isArray(conversation)) { //Private message
            var encoded = await this.loginmethod.encodeContent(msg, user, conversation, keychainKeyType); 
            this.recentlySentEncodedContent.push([encoded, msg]);
            msg = encoded;
        }
        else if(conversation.startsWith('#')) { //Group Message
            encodeKey = await this.getKeyFor(conversation);
            if(encodeKey === null) {
                console.log("unknown key"); //TODO ask to enter key
                return;
            }
        } 
        var signableMessage = msg.forUser(user, conversation);
        await this.loginmethod.signMessage(signableMessage, keychainKeyType);
        if(encodeKey !== null) signableMessage.encodeWithKey(encodeKey);
        return await client.write(signableMessage);
    }
    resolveReferences(messages: DisplayableMessage[]) {
        for(var msg of messages) this.resolveReference(messages, msg);
    }
    resolveReference(messages: DisplayableMessage[], msg: DisplayableMessage) {
        try {
            var content = msg.content;
            if(content instanceof Thread) 
                content = content.getContent();
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
                        else if(content instanceof Emote) {
                            m.emote(msg);
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
    popRecentlySentEncodedContent(encoded: Encoded): JSONContent {
        var arr = this.recentlySentEncodedContent;
        for(var i = arr.length-1; i >= 0; i--) {
            if(encoded.isEqual(arr[i][0])) {
                var decoded = arr[i][1];
                arr.splice(i, 1);
                return decoded;
            }
        }
        return null;
    }
    hasMessage(messages: DisplayableMessage[], message: DisplayableMessage): boolean {
        if(messages != null && message != null)
            for(var msg of messages)
                if(msg.getTimestamp() === message.getTimestamp() &&
                    msg.getUser() === message.getUser() && 
                    msg.message.getSignature().equals(message.message.getSignature())) 
                    return true;
        return false;
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
            var decoded = this.popRecentlySentEncodedContent(content);
            if(decoded !== null) content = decoded;
            /*var decoded = await content.decodeWithKeychain(this.user, msg.getGroupUsernames());
            content = decoded;*/
        }
        
        var displayableMessage = new DisplayableMessage(msg);
        if(content instanceof Thread) {
            var threadContent = content.getContent();
            if(threadContent instanceof Edit) {
                var editContent = threadContent.getEdit();
                displayableMessage.editContent = Content.thread(content.getName(), (editContent == null)?null:Content.fromJSON(editContent));
                displayableMessage.isEdit = true;
            }
        }
        else if(content instanceof Edit) {
            var editContent = content.getEdit();
            displayableMessage.editContent = (editContent == null)?null:Content.fromJSON(editContent);
            displayableMessage.isEdit = true;
        }
        displayableMessage.content = content;
        displayableMessage.verified = verified;
        displayableMessage.init();
        return displayableMessage;
    }
    async decodeSelectedConversations(): Promise<void> {
        var data = await this.getSelectedConversations();
        if(data && data.encoded && data.encoded.length > 0) {
            var encodedArray = data.encoded;
    
            var toAdd = [];
            try {
                while(encodedArray.length > 0) {
                    var encodedMessage = encodedArray.shift();
                    try {
                        var decodedMessage = await this.decode(encodedMessage);
                        data.messages.push(decodedMessage);
                        this.resolveReference(data.messages, decodedMessage);
                        this.postCallbackEvent(decodedMessage);
                    }
                    catch(e) {
                        toAdd.push(encodedMessage);
                        console.log(e);
                        if(e.success !== undefined && e.success === false) {
                            if(e.error === "user_cancel") return;
                        }
                    }   
                }
            }
            finally { 
                encodedArray.push.apply(encodedArray, toAdd);
                this.postCallbackEvent(decodedMessage);
            }
        }
    }
    async decode(displayableMessage: DisplayableMessage): Promise<DisplayableMessage> {
        var msg = displayableMessage.message;
        var content = displayableMessage.content;
        if(content instanceof Encoded) {
            var decoded = await content.decodeWithKeychain(this.user, msg.getGroupUsernames());
            content = decoded;
        }
        displayableMessage.content = content;
        displayableMessage.init();
        return displayableMessage;
    }
}
