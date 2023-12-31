import { Client, CallbackResult } from './client'
import { Community } from './community'
import { DataPath } from './data-path'
import { Utils, AccountDataCache } from './utils'
import { SignableMessage } from './signable-message'
import { DisplayableMessage } from './displayable-message'
import { UserStorage, LocalUserStorage, EncodedPublicStorage } from './manager/user-storage'
import { LastRead } from './manager/last-read'
import { JSONContent, Content, Edit, Emote, Flag, Encoded, Preferences,
         PrivatePreferences, OnlineStatus, Thread, WithReference } from './content/imports'

declare var io: any;
declare var window: any;

export interface LoginMethod {
    decodePrivatePreferences(preferences: Preferences): Promise<PrivatePreferences>;
    encodePrivatePreferences(preferences: Preferences);
    encodeContent(content: JSONContent, user: string,
         groupUsers: string[], keychainKeyType: string): Promise<Encoded>;
    encodeText(text: string): Promise<string>;
    decodeText(text: string): Promise<string>;
    signMessage(message: SignableMessage, keychainKeyType: string): Promise<SignableMessage>;
    broadcastOps(ops: any[], keychainKeyType: string): Promise<any>;
}
export class LoginKey implements LoginMethod {
    user: string
    key: any
    publickey: any
    keystring: string
    publickeystring: string
    constructor(user: string, key: string) {
        this.user = user;
        this.key = Utils.dhive().PrivateKey.fromString(key);
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
    async encodeText(text: string): Promise<string> {
        return await Content.encodeTextWithKey(text, this.keystring, this.publickeystring);
    }
    async decodeText(text: string): Promise<string> {
        return await Content.decodeTextWithKey(text, this.keystring);
    }
    async encodeContent(content: JSONContent, user: string,
         groupUsers: string[], keychainKeyType: string): Promise<Encoded> {
        return await content.encodeWithKey(user, groupUsers, keychainKeyType, this.keystring);
    }
    async signMessage(message: SignableMessage, keychainKeyType: string): Promise<SignableMessage> {
        return message.signWithKey(this.key, keychainKeyType);
    }
    async broadcastOps(ops: any[], keychainKeyType: string): Promise<any> {
        if(keychainKeyType !== 'Posting') throw 'unsupported key ' + keychainKeyType;
        return await Utils.getDhiveClient().broadcast.sendOperations(ops, this.key);
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
    async encodeText(text: string): Promise<string> {
        return await Content.encodeTextWithKeychain(this.user, text);
    }
    async decodeText(text: string): Promise<string> {
        return await Content.decodeTextWithKeychain(this.user, text);
    }
    async signMessage(message: SignableMessage, keychainKeyType: string): Promise<SignableMessage> {
        return await message.signWithKeychain(keychainKeyType);
    }
    async broadcastOps(ops: any[], keychainKeyType: string): Promise<any> {
        if(keychainKeyType !== 'Posting') throw 'unsupported key ' + keychainKeyType;
        var p = Utils.queueKeychain((keychain, resolve, error)=>{
            keychain.requestBroadcast(this.user, ops, keychainKeyType,
                (result)=>{
                if(result.success) {
                    resolve(true);
                }
                else error(result);
            });
        });
        return await p;
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
export class UserOnlineStatus {
    user: string
    content: OnlineStatus
    message: SignableMessage 
    verified: boolean  
    constructor(user: string, content: OnlineStatus, message: SignableMessage, verified: boolean) {
        this.user = user;
        this.content = content;
        this.message = message;
        this.verified = verified;
    }
    isOnline() { 
        return this.content && this.content.isOnline();
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
    onstatusmessage: EventQueue = new EventQueue()
    onpreferences: EventQueue = new EventQueue()
    onlastread: EventQueue = new EventQueue()
    oncommunityhide: EventQueue = new EventQueue()

    private loginmethod: LoginMethod

    joined: any = {}
    cachedUserMessagesPromise: Promise<DisplayableMessage[]> = null
    cachedUserMessages: DisplayableMessage[] = null
    cachedUserMessagesLoadedAll: boolean = false
    cachedUserConversations: string[] = null
    recentlySentEncodedContent: any = []
    
    conversationsLastReadData: LastRead = new LastRead()    
    conversationsLastMessageTimestamp = {}
    cachedGroupLastMessageTimestamp = null
    selectedCommunityPage: any = {}
    selectedConversation: string = null
    selectedOnlineStatus: string = null
    conversations: AccountDataCache = new AccountDataCache()
    communities: AccountDataCache = new AccountDataCache()
    upvotes: AccountDataCache = new AccountDataCache()

    lastReadDataTimer: any = null
    onlineStatusTimer: any = null
    paused: boolean = false

    cachedGuestData = null
    cachedHiddenUsers = null

    keys: any = {}
    keychainPromise: Promise<any> = null
    
    defaultReadHistoryMS: number
    pauseAutoDecode: boolean = false
    autoReconnect: boolean = false

    clientInfo: any = null
    constructor() {
        this.defaultReadHistoryMS = 30*24*60*60000; 
    }
    /*
    List of backend messaging nodes to connect to. 
    */
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
                if(_this.autoReconnect) {
                    _this.nodeIndex = _this.nodeIndex+1;
                    _this.connect();
                }
            });
            socket.on('disconnect', function() {
                console.log("disconnected ");
            });
                 
            this.client = new Client(socket);
            socket.on("connect", function() {
                console.log("connect");
                _this.client.readInfo().then((result)=>{
                    if(result.isSuccess())
                        _this.clientInfo = result.getResult();
                });
                for(var room in _this.joined)
                    _this.client.join(room);
                _this.reload();
            });
            this.client.onupdate = function(data) { _this.handleJSONUpdate(data); }; 
            this.client.onmessage = function(json) { _this.handleJSONMessage(json); };
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
    close() {
        try {
            if(this.lastReadDataTimer != null) {
                clearInterval(this.lastReadDataTimer);
                this.lastReadDataTimer = null;
            }
            if(this.onlineStatusTimer != null) {
                clearInterval(this.onlineStatusTimer);
                this.onlineStatusTimer = null;
            }
        }
        catch(e) {
            console.log(e);
        }
        try {
            if(this.client) this.client.close();
        }
        catch(e) {
            console.log(e);
        }
    }
    async reload() {
        try {
            this.conversations.clearPending();
        }
        catch(e) {
            console.log(e);
        }
        var client = this.getClient();            
        var timeNow = Utils.utcTime();
        var maxTime = timeNow+600000;
        var conversations = Object.keys(this.conversations.data);
        for(var conversation of conversations) {
            try { 
                if(Utils.isCommunityConversation(conversation) || Utils.isJoinableGroupConversation(conversation)) {
                    var readFrom = Utils.isJoinableGroupConversation(conversation)?
                       (await Utils.getGroupTimestamp(conversation)):0;
                    var result = await client.read(conversation, readFrom, maxTime);
                    if(result.isSuccess()) {
                        var messages = result.getResult();
                        for(var message of messages) 
                            await this.handleJSONMessage(message, false);
                    }
                }
            }
            catch(e) {
                console.log(e);                
            }
        }
        try {
            if(this.user !== null) {
                var result = await client.readUserMessages(this.user);
                if (result.isSuccess())
                    var messages = result.getResult();
                    for(var message of messages) 
                        await this.handleJSONMessage(message, false);
                }
        }
        catch(e) {
            console.log(e);
        }
        this.postCallbackEvent(null);
    }
    async pause(yes: boolean = true) {
        if(this.paused === yes) return;
        this.paused = yes;
        if(yes) {
            this.client.close();
        }
        else {
            this.connect();
        }
    }
    async handleJSONUpdate(json: any) {
        try {
            switch(json[0]) {
                case "v": 
                    var upvoteParts = [json[1], json[2], json[3], json[4], json[5]];
                    var conversation = upvoteParts[1];
                    var data = this.upvotes.lookupValue(conversation);
                    if(data) {
                        var index = Utils.indexOfArray(data, upvoteParts);
                        if(index === -1) { 
                            data.push(upvoteParts);
                            var data = this.conversations.lookupValue(conversation);
                            if(data != null) {
                                for(var message of data.messages) {
                                    if(message.getUser() === upvoteParts[0] &&
                                       message.getConversation() === upvoteParts[1] &&
                                      message.getTimestamp() == upvoteParts[2]) {
                                        var _this = this;
                                        this.resolveUpvotes(message, ()=>{
                                            if(conversation === _this.selectedConversation) {
                                                 _this.postCallbackEvent(null)
                                            }
                                        }, 5000);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                break;
            }
        }
        catch(e) {
            console.log(e);
        }
    }
    async handleJSONMessage(json: any, update: boolean = true): Promise<any> {
        try {
            var signableMessage = SignableMessage.fromJSON(json);
            if(signableMessage.getMessageType() !== SignableMessage.TYPE_WRITE_MESSAGE) {
                this.handleMessage(signableMessage);
                return signableMessage;
            }
            var displayableMessage = await this.signableToDisplayable(signableMessage);
            this.handleDisplayableMessage(displayableMessage, update);
            return displayableMessage;
        }
        catch(e) {
            console.log(e);
        }
        return null;
    }
    handleMessage(signableMessage: SignableMessage) {
        if(signableMessage.getMessageType() !== SignableMessage.TYPE_MESSAGE) return;
        var content = signableMessage.getContent();
        if(content instanceof OnlineStatus) {
            var status = [signableMessage.getUser(), signableMessage.getConversation(), content.getStatus(), signableMessage.getTimestamp()];
            if(signableMessage.isOnlineStatus()) {
                this.onstatusmessage.post(status);
            }
            else {
                var data = this.conversations.lookupValue(signableMessage.getConversation());
                if(data != null) {
                    data.status[signableMessage.getUser()] = status;
                    this.onstatusmessage.post(status);
                }
            }
        }
    }
    async handleDisplayableMessage(displayableMessage: DisplayableMessage, update: boolean = true) {
        var _this = this;
        var signableMessage = displayableMessage.message;
        var conversation = displayableMessage.getConversation();
        var data = _this.conversations.lookupValue(
                        displayableMessage.getConversation());
        if(conversation.indexOf('|') !== -1) {
            if(_this.cachedUserMessages != null && !_this.hasMessage(_this.cachedUserMessages, displayableMessage)) {
                _this.cachedUserMessages.unshift(displayableMessage);
                _this.cachedUserMessages.sort((a,b)=>a.getTimestamp()-b.getTimestamp());
            }
            if(_this.cachedUserConversations != null && 
                    _this.cachedUserConversations.indexOf(conversation) === -1)
                    _this.cachedUserConversations.unshift(conversation);
            if(data == null)
                data = await _this.getSelectedConversations(conversation);
        }

        if(data != null) {
            if(_this.hasMessage(data.encoded, displayableMessage) || _this.hasMessage(data.messages, displayableMessage)) 
                return;
            var lastRead = _this.conversationsLastReadData.lookup(conversation);
            if(lastRead == null) 
                lastRead = _this.conversationsLastReadData.store(conversation, 0, 0);
            if(_this.selectedConversation === conversation) 
                _this.setLastRead(conversation, displayableMessage.getTimestamp());
            else if(displayableMessage.getTimestamp() > lastRead.timestamp) {
                _this.conversationsLastReadData.store(conversation, lastRead.timestamp, lastRead.number+1);
            }

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
                delete data.status[displayableMessage.getUser()];
                _this.onstatusmessage.post([displayableMessage.getUser(), displayableMessage.getConversation(), null, 0]);
            }
        }
        var mentions = signableMessage.getMentions();
        if(mentions != null) {
            if(mentions.indexOf(_this.user) !== -1) {
                data = _this.conversations.lookupValue('&'+_this.user);
                if(data != null) {
                    if(data.encoded != null && displayableMessage.isEncoded()) {}
                    else { 
                        data.messages.push(displayableMessage);
                    }
                }
            }
            for(var mention of mentions) {
                if(mention.endsWith('/*') 
                    && Utils.getConversationUsername(conversation) === mention.substring(0,mention.length-2)) {
                    data = _this.conversations.lookupValue('&'+mention);
                    if(data != null) {
                        if(data.encoded != null && displayableMessage.isEncoded()) {}
                        else { 
                            data.messages.push(displayableMessage);
                        }
                    }
                }
            }
        }  
        if(update) _this.postCallbackEvent(displayableMessage);  
    }
    getClient(): Client { return this.client; }
    setUser(user: string, joinRooms: boolean = true) {
        if(this.user == user) return;
        if(this.user != null) {
            if(joinRooms) {
                for(var room in this.joined)
                    this.leave(room);
            }
            this.userPreferences = null;
            this.cachedUserConversations = null;
        }
        this.user = user;
        if(user !== null) {
            try {
                this.conversationsLastReadData.setStorageMethod(new LocalUserStorage(user));
                this.conversationsLastReadData.load();
            }
            catch(e) { console.log(e); }
            if(joinRooms) {
                this.join(user);
                this.join('&'+user);
                this.join('$online');
            }
        }
    }
    async setLastReadDataSync(enabled: boolean = true) {
        var user = this.user;
        if(user == null || Utils.isGuest(user)) enabled = false;
        if(enabled) {
            var onlineKey = await this.getKeyFor('$');
            if(onlineKey == null) return;
            this.conversationsLastReadData.setSharedStorage(new EncodedPublicStorage(user, onlineKey));
            if(this.lastReadDataTimer != null) return;
            var _this = this;
            var fn = async ()=>{
                if(_this.paused) return;
                if(_this.conversationsLastReadData) {
                    var updated = await _this.conversationsLastReadData.sync();
                    if(updated) this.onlastread.post(null);
                }
            };
            this.lastReadDataTimer = setInterval(fn,5*60*1000);
            fn();
        }
        else {
            if(this.lastReadDataTimer == null) return;
            clearInterval(this.lastReadDataTimer);
            this.lastReadDataTimer = null;
        }
    }
    readHiddenUsers(): any {
        if(this.cachedHiddenUsers != null) return this.cachedHiddenUsers;
        var hideusers = window.localStorage.getItem("#hideusers");
        var obj = (hideusers == null)?{}:JSON.parse(hideusers);
        this.cachedHiddenUsers = obj;
        return obj;
    }
    hideUsers(users: string[], add: boolean = true) {
        var hideusers = add?this.readHiddenUsers():{};
        for(var user of users) hideusers[user] = true;
        window.localStorage.setItem("#hideusers", JSON.stringify(hideusers));
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
            var piKey = Utils.dhive().PrivateKey.fromLogin(username,
                Utils.createRandomPassword()+Math.random(),"posting"); 
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
            var privatePref = preferences.getPrivatePreferencesWithKey(storePrivateKeyLocally);
            preferences.createGuestAccount(message);
            MessageManager.setupOnlineStatusGenerateOnlineKey(username, preferences, privatePref);
            preferences.encodePrivatePreferencesWithKey(storePrivateKeyLocally, publicPostingKey);
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
    setOnlineStatusTimer(enabled: boolean): void {
        if(enabled) {
            if(this.onlineStatusTimer != null) return;
            var _this = this;
            this.onlineStatusTimer = setInterval(()=>{
                if(_this.paused) return;
                _this.sendOnlineStatus("true");
            },5*60*1000);
        }
        else {
            if(this.onlineStatusTimer == null) return;
            clearInterval(this.onlineStatusTimer);
            this.onlineStatusTimer = null;
        }
    }
    async joinGroups() {
        var groups = await this.getJoinedAndCreatedGroups();
        for(var conversation in groups)
           this.join(conversation);
    }
    async joinCommunities(communities: any = null) {
        if(this.user == null) return;
        if(communities === null) communities = await this.getCommunities(this.user);
        var chanMap = {};
        for(var community of communities) {
            try {
                var chan = community[0]+'/*';
                this.join(chan);
                chanMap[chan] = true;
            }
            catch(e) { console.log(e); }
        }
        var chanList = Object.keys(chanMap);
        if(chanList.length > 0) {
            var client = this.getClient();
            var result = await client.readStats(chanList);
            if(result.isSuccess()) {
                this.conversationsLastMessageTimestamp = result.getResult()[1];
            }
            this.postCallbackEvent(null);
        }
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
        if(this.keychainPromise != null) {
            try { 
                return await this.keychainPromise;
            }
            catch(e) { 
                console.log(e);
            }
        }
        var promise = this.loginmethod.decodePrivatePreferences(p);
        this.keychainPromise = promise;
        try {
            var preferences = await promise;
        }
        catch(e) {
            console.log(e);
            this.keychainPromise = null;
        }
        return preferences;
    }
    async storeKeyLocallyEncrypted(group: string, key: string) {
        var encodedText = await this.loginmethod.encodeText(key);
        window.localStorage.setItem(this.user+"|"+group, encodedText);
        var keys = this.keys;
        keys[group] = key;
    }
    async storeKeyGloballyInPrivatePreferences(group: string, key: string): Promise<CallbackResult> {
        var pref = await this.getPreferences();
        var privatePref = await this.getPrivatePreferences();
        privatePref.setKeyFor(group, key);
        return await this.updatePreferences(pref);
    }
    async getKeyFor(group: string): Promise<string> {
        var keys = this.keys;
        if(keys[group] != null) return keys[group];
        var pref = await this.getPrivatePreferences();
        var key = pref.getKeyFor(group);
        if(key === null) {
            var text = window.localStorage.getItem(this.user+"|"+group); 
            if(text != null) {
                keys[group] = key = await this.loginmethod.decodeText(text);
            }
        }
        return key;
    }
    async renameGroup(group: string, name: string): Promise<boolean> {
        var array = Utils.parseGroupConversation(group);
        if(array == null) return false;        
        var pref = await this.getPreferences();
        var groupData = pref.getGroup(array[2]);
        if(groupData == null) return false;
        if(groupData['name'] !== name) {
            groupData['name'] = name;
            await this.updatePreferences(pref);
        }
        return true;
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
    messageToLink(message: SignableMessage): string {
        try {
            var conversation = message.getConversation();
            var link = null;
            if(Utils.isCommunityConversation(conversation)) {
                var data = Utils.parseConversation(conversation);
                var communityName = data[0];
                var commuityPath = data[1];
                if(Utils.isValidGuestName(communityName) && /[a-zA-Z0-9-_]+/.test(commuityPath)) {
                    link = `/t/${communityName}/${commuityPath}?j=${message.getReference()}`;
                }
            }
            else if(Utils.isGroupConversation(conversation)) {
                var user = this.user;
                var users = Utils.getGroupUsernames(conversation);
                link = '/p';
                for(var user0 of users) {
                    if(user0 === user) continue;
                    link += '/'+user0;
                }
                link += `?j=${message.getReference()}`;
            }
            else if(Utils.isJoinableGroupConversation(conversation)) {
                link = '/g/'+conversation.substring(1);
            }
            return link;
        }
        catch(e) { console.log(e); }
        return null;
    }
    async readUpvotes(conversation: string): Promise<any[]> {
        var client = this.client;
        if(client == null) return []; 
        if(!this.clientInfo || this.clientInfo.version <= 10) return [];
        return await this.upvotes.cacheLogic(conversation, (conversation)=>{
            return client.readUpvotes([conversation]).then((result)=>{
                if(result.isSuccess()) { 
                    var obj = result.getResult();
                    if(obj[conversation]) return obj[conversation];
                }
                return [];
            });
        });
    }
    async findUpvoteForMessage(message: SignableMessage): Promise<any> {
        var user = message.getUser();
        var conversation = message.getConversation();
        var timestamp = message.getTimestamp();
        var array = await this.readUpvotes(conversation);
        for(var i = array.length-1; i >= 0; i--)
            if(array[i][0] === user && array[i][1] === conversation &&
                array[i][2] == timestamp) return array[i];
        return null;
    }
    findUpvote(array: any[], permlink: string): boolean {
        for(var i = array.length-1; i >= 0; i--)
            if(array[i][4] === permlink) return array[i];
        return null;
    }
    async upvotePost(author: string, permlink: string, weight: number = 10000): Promise<boolean> {
        var user = this.user;
        if(user === null || Utils.isGuest(user)) return false;
        var votes = await Utils.getDhiveClient().database
                    .call('get_active_votes', [author, permlink]);
        for(var vote in votes)
            if(votes[vote].voter === user) return false;
        var ops = [];
        ops.push(["vote", { voter: user, author, permlink, weight }]);
        await this.loginmethod.broadcastOps(ops, 'Posting');  
        return true;
    }
    async upvote(msg: SignableMessage, weight: number = 10000,
        content: JSONContent = null, contentText: string = null,
        parentAuthor: string = "peak.open.chat"): Promise<any> {
        var user = this.user;
        if(user === null || Utils.isGuest(msg.getUser()) || msg.getUser() === user) return false;
        var conversation = msg.getConversation();
        var permlink = Utils.encodeUpvotePermlink(msg.getUser(), conversation, msg.getTimestamp()); 
        //fetch upvotes  
        var client = this.getClient();   
        var result = await client.readUpvotes([conversation]);
        if(result.isSuccess()) {
            var map = result.getResult();
            var array = map[conversation];
            var upvote;
            var ops = [];
            var author;
            if(array && (upvote=this.findUpvote(array, permlink))) {
                author = upvote[3];
                //post already exists, check if already upvoted
                var votes = await Utils.getDhiveClient().database
                    .call('get_active_votes', [author, permlink]);
                for(var vote in votes)
                    if(votes[vote].voter === user) return false;
            } 
            else {
                //find newest parent container post
                //create new upvote post
                var meta = { tags: [], app: "stmsg" };
                if(contentText == null) {
                    if(content == null)
                        content = msg.getContent();
                    if(content instanceof Thread) 
                        content = content.getContent();
                    
                    contentText = "";
                    var titleText = conversation;
                    var conversationLink = "https://chat.peakd.com";
                    if(Utils.isCommunityConversation(conversation)) {
                        if(content["getText"] !== undefined) {
                            contentText = (content as any).getText();
                        }
                        try {
                            var communityUsername = Utils.getConversationUsername(conversation);
                            meta.tags.push(communityUsername);
                            var communityPath = Utils.getConversationPath(conversation);
                            var community = await Community.load(communityUsername);
                            var stream = (community)?community.findTextStreamById(''+communityPath):null;
                            titleText = `**${community.getTitle()} | ${stream?stream.getName():''}** | ${conversation}`;
                        }
                        catch(e) {console.log(e); }
                    }
                    else if(Utils.isJoinableGroupConversation(conversation)) {
                        titleText = await Utils.getGroupName(conversation);
                    }
                    else if(Utils.isGroupConversation(conversation)) {
                        titleText = Utils.getGroupUsernames(conversation).join(" | ")
                    }

                    var msgLink = this.messageToLink(msg);
                    if(msgLink) conversationLink += msgLink;
                    
                    contentText = 
`<sup> [Conversation ${titleText}](${conversationLink})</sup>
![](https://images.hive.blog/u/${msg.getUser()}/avatar/small) @${msg.getUser()}

${contentText}

<sup>**Continue conversation** ${conversationLink}</sup>`;

                }
                
                author = user;

                var containerThread = await Utils.getDhiveClient().database
                .getDiscussions("blog", {tag:parentAuthor, limit:1});
                
                if(containerThread.length <= 0 || containerThread[0].author !== parentAuthor) {
                    return false;
                }
                
                var parentPermlink = containerThread[0].permlink;
                
                ops.push(["comment", {
                    parent_author: parentAuthor,
                    parent_permlink: parentPermlink,
                    author,
                    permlink,
                    title: '',
                    body: contentText,
                    json_metadata: JSON.stringify(meta)
                }]);
                ops.push(["comment_options", {
                    author,
                    permlink: permlink,
                    max_accepted_payout: "1000000.000 HBD",
                    "percent_hbd": 5000,
                    "allow_votes": true,
                    "allow_curation_rewards": true,
                    "extensions": [[0, {
                        "beneficiaries": [{"account": msg.getUser(), "weight": 10000}]
                    }]]
                }]);
                
            }
            //upvote post
            ops.push(["vote", { voter: user, author, permlink, weight }]);
                
            console.log("prepared ops: ", ops); 
            await this.loginmethod.broadcastOps(ops, 'Posting');  
            return true;            
        }
        else return false;   
    }
    join(room: string) {
        if(room == null) return;
        if(room.indexOf('|') != -1) return;
        if(this.joined[room]) return;
        this.joined[room] = true;
        var client = this.getClient();
        client.join(room);
    }
    leave(room: string) {
        if(room == null) return;
        if(room.indexOf('|') != -1) return;
        if(!this.joined[room]) return;
        delete this.joined[room];
        var client = this.getClient();
        client.leave(room);
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
    async setSelectedOnlineStatus(writing: boolean) {
        var conversation = this.selectedConversation;
        if(conversation) {
            if(conversation === this.selectedOnlineStatus) {
                if(!writing) {
                    await this.sendOnlineStatus(null, conversation);
                    this.selectedOnlineStatus = null;
                }
            }
            else {
                if(writing) {
                    if(this.selectedOnlineStatus !== null) 
                        await this.sendOnlineStatus(null, this.selectedOnlineStatus);
                    await this.sendOnlineStatus('writing', conversation);
                    this.selectedOnlineStatus = conversation;
                }
            }
        }
    }
    getSelectedWritingUsers(conversation: string = this.selectedConversation, time: number = 300000): string[] {
        var result = [];
        if(conversation != null) {
            var data = this.conversations.lookupValue(conversation);
            if(data != null) {
                var minTime = Utils.utcTime()-time;
                for(var user in data.status) {
                    var status = data.status[user];
                    if(status[2] != null && status[3] >= minTime)
                        result.push(user);
                }
            }
        }
        return result;
    }
    addCommunity(community: string, add: boolean = true, user: string = this.user) {
        var obj = this.loadCommunityHiddenLocally(user);
        if(obj === null) obj = {};
        if(add) obj[community] = false;
        else delete obj[community];
        this.storeCommunityHiddenLocally(obj, user);
    }
    hideCommunity(community: string, hide: boolean = true, user: string = this.user) {
        var obj = this.loadCommunityHiddenLocally(user);
        if(obj === null) obj = {};
        if(hide) obj[community] = true;
        else delete obj[community];
        this.storeCommunityHiddenLocally(obj, user);
    }
    storeCommunityHiddenLocally(hidden: any, user: string = this.user) {
        window.localStorage.setItem(user+"|hiddenCommunity|", JSON.stringify(hidden));
        this.oncommunityhide.post(hidden);
    }
    loadCommunityHiddenLocally(user: string = this.user): any {
        try {
            var str = window.localStorage.getItem(user+"|hiddenCommunity|");
            if(str == null) return null;
            var result = JSON.parse(str);
            if(typeof result === 'object' && result.constructor === Object) return result;
        }
        catch(e) { console.log(e); }
        return null;
    }
    storeCommunitySortOrderLocally(sortOrder: string[], user: string = this.user) {
        window.localStorage.setItem(user+"|sortOrder|", JSON.stringify(sortOrder));
    }
    loadCommunitySortOrderLocally(user: string = this.user): string[] {
        try {
            var str = window.localStorage.getItem(user+"|sortOrder|");
            if(str == null) return null;
            var result = JSON.parse(str);
            if(Array.isArray(result)) return result;
        }
        catch(e) { console.log(e); }
        return null;
    }
    async getCommunitiesHidden(user: string = this.user) : Promise<any> {
        var tmpArray = [];
        var array = await this.getCommunities(user);
        var hide = this.loadCommunityHiddenLocally(user);
        if(hide != null) {
            for(var item of array) {
                if(hide[item[0]] === true) tmpArray.push(item);
            }
            return tmpArray;
        }
        return tmpArray;
    }
    async getCommunitiesSorted(user: string = this.user, sortOrder: string[] = null,
         applyHide: boolean = true, prepend: string[] = null): Promise<any> {
        if(sortOrder == null) sortOrder = this.loadCommunitySortOrderLocally(user);
        var array = await this.getCommunities(user);
        var added = {};
        for(var item of array) added[item[0]] = true;
        var hide = null;
        var tmpPrepend = [];
        if(prepend != null) for(var community of prepend) {
            if(added[community]) continue;
            added[community] = true;
            var title = "";            
            try { 
                var community0 = await Community.load(community);
                title = community0.getTitle();
            }
            catch(e) { console.log(e); }
            tmpPrepend.push([community, title, "guest", ""]);
        }
        if(applyHide && (hide = this.loadCommunityHiddenLocally(user)) != null) {
            for(var community in hide) {
                if(hide[community] === false && !added[community]) {
                    added[community] = true;
                    var title = "";            
                    try { 
                        var community0 = await Community.load(community);
                        title = community0.getTitle();
                    }
                    catch(e) { console.log(e); }
                    tmpPrepend.push([community, title, "guest", ""]);
                }
            }
        }
        array = tmpPrepend.concat(array);
        var sortedArray = [];
        var tmpArray = [];
        for(var item of array) {
            if(hide != null && hide[item[0]] === true) continue;
            var index = sortOrder != null?sortOrder.indexOf(item[0]):-1;
            if(index === -1) sortedArray.push(item);
            else tmpArray[index] = item;
        }
        for(var item of tmpArray)
            if(item != null) 
                sortedArray.push(item);
        for(var item of array)
            if(item.account == null) item.account = await Utils.getAccountData(item[0]);
        return sortedArray;
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
            }):Utils.getDhiveClient().hivemind.listAllSubscriptions({"account":user});
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
    async getCachedGroupTimestamps(conversations: string[]): Promise<any> {
        if(this.cachedGroupLastMessageTimestamp == null) {
            try {
                var client = this.getClient();
                var result = await client.readStats(conversations);
                if(result.isSuccess()) this.cachedGroupLastMessageTimestamp = result.getResult()[1];
            }
            catch(e) { console.log(e); }
        }
        return this.cachedGroupLastMessageTimestamp;
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
                conversation, username, id, lastReadNumber: 0, timestamp: 0, plus: ''
            };
        }
        for(var groupId in pref.getGroups()) {
            var conversation = '#'+this.user+'/'+groupId;
            if(groups[conversation] !== undefined) continue;
            groups[conversation] = {
                conversation, "username": this.user, "id":groupId,
                lastReadNumber: 0, timestamp: 0, plus: ''
            };
        }
        for(var conversation in groups) {
            var lastRead = this.getLastRead(conversation);
            if(lastRead != null) {
                groups[conversation].lastReadNumber = lastRead.number;
                groups[conversation].timestamp = lastRead.timestamp;
            }
        }
        var stats = await this.getCachedGroupTimestamps(Object.keys(groups));
        if(stats != null) {
            for(var group in groups) {
                var timestamp = stats[group];
                if(timestamp !== undefined && timestamp > groups[group].timestamp) {
                    groups[group].timestamp = timestamp;
                    groups[group].lastReadNumber = Math.max(1, groups[group].lastReadNumber);
                    groups[group].plus = '+';
                    var lastRead = this.getLastRead(group);
                    if(lastRead != null) lastRead.number = Math.max(1,lastRead.number);
                    else this.setLastRead(group, 0, 1);
                }
            }
        }
        return groups;
    }
    getLastReadNumber(conversation: string): any {
        var lastRead = this.conversationsLastReadData.lookup(conversation);
        return lastRead == null?0:lastRead.number;
    }
    getLastRead(conversation: string): any {
        var lastRead = this.conversationsLastReadData.lookup(conversation);
        return lastRead == null?null:lastRead;
    }
    setLastRead(conversation: string, timestamp: number, number: number = 0): boolean {
        var refreshNeeded = false;
        var lastRead = this.conversationsLastReadData.lookup(conversation);
        if(lastRead != null)
            refreshNeeded = number===0 && lastRead.number > 0;
        this.conversationsLastReadData.store(conversation, timestamp, number);
        if(refreshNeeded) this.onlastread.post(lastRead);
        return refreshNeeded;
    }
    async getLastReadTotalConversations(): Promise<number> {
        var conversations = await this.readUserConversations();
        var number = 0;
        for(var conversation of conversations) {
            var lastRead = this.getLastRead(conversation);
            if(lastRead != null && lastRead.number > 0)
                number++;
        }            
        var groups = await this.getJoinedAndCreatedGroups();
        for(var conversation in groups)
            if(groups[conversation].lastReadNumber > 0)
                number++;
        return number;
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
    async getLastReadCommunityStream(conversation: string): Promise<string> {
        var lastRead = this.getLastRead(conversation);
        var number = 0;
        if(lastRead != null) number += lastRead.number;
        var timestamp = this.conversationsLastMessageTimestamp[conversation];
        if(timestamp != null) {
             if(lastRead == null || lastRead.timestamp < timestamp) {
                 if(lastRead == null) this.setLastRead(conversation, 0, number=1);
                 else lastRead.number = number = Math.max(1, lastRead.number);   
                 return number+'+';
             }
        }
        return ""+number;
    }
    async getLastReadCommunity(community: string): Promise<string> {
        var communityData = await Community.load(community);
        var role = communityData.getRole(this.user);
        var titles = communityData.getTitles(this.user);
        var communityStreams = community+'/';
        var data = this.conversationsLastReadData.data;
        var number = 0;
        for(var conversation in data) {
            if(conversation === community || conversation.startsWith(communityStreams)) {
                var lastRead = data[conversation];
                if(lastRead != null) {
                    var stream = communityData.findTextStreamById(conversation.substring(communityStreams.length)); 
                    if(stream != null && stream.readSet.validate(role, titles))
                        number += lastRead.number;
                }
            }
        }
        var plus = '';        
        var timestamps = this.conversationsLastMessageTimestamp;
        for(var conversation in timestamps) {
            if(conversation === community || conversation.startsWith(communityStreams)) {
                var lastRead = data[conversation];
                var timestamp = timestamps[conversation];
                if(lastRead == null || lastRead.timestamp < timestamp) {
                    var stream = communityData.findTextStreamById(conversation.substring(communityStreams.length)); 
                    if(stream != null && stream.readSet.validate(role, titles)) {
                        number++;
                        plus = '+';
                    }
                }
            }
        }
        return number+plus;
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
                var result = await client.readUserMessages(this.user, -1, maxTime); //TODO add last id
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
                var minTime = 0;
                if(Utils.isJoinableGroupConversation(conversation))
                    minTime = await Utils.getGroupTimestamp(conversation);
                var result = await client.read(conversation, minTime, maxTime); //TODO add last id
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
    async getSelectedConversations(conversation: string = this.selectedConversation, asyncVerify: boolean = true): Promise<any> {
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
                if(_this.cachedUserMessagesPromise == null) {
                    promise = _this.cachedUserMessagesPromise = _this.readUserMessages().then((result)=>{
                        this.cachedUserMessages = result;
                        this.cachedUserMessagesLoadedAll = false;
                        return result;
                    });
                }
                else if(_this.cachedUserMessages == null) promise = _this.cachedUserMessagesPromise;
                else promise = Promise.resolve(_this.cachedUserMessages);
                promise = promise.then((allMessages)=>{
                    var messages0 = allMessages.filter(
                        (m)=>m.getConversation()===conversation);
                    var messages = messages0.filter((m)=>!m.isEncoded());
                    var encoded = messages0.filter((m)=>m.isEncoded());
                    if(_this.cachedUserMessagesLoadedAll) maxTime = 0;
                    return {messages, encoded, maxTime, status:{}};
                })
            }
            else {
                var readFrom = Utils.isJoinableGroupConversation(conversation)?
                    Utils.getGroupTimestamp(conversation):Promise.resolve(0);
                promise = readFrom.then((minTime)=>{
                    return client.read(conversation, minTime,  /*timeNow-_this.defaultReadHistoryMS; */ 
                       maxTime);
                }).then((result)=>{
                if(!result.isSuccess()) throw result.getError();
                    return _this.toDisplayable(result, asyncVerify);
                }).then((messages)=>{
                    _this.resolveReferences(messages);
                    if(messages.length < 100) maxTime = 0;
                    return {messages, maxTime, status:{}};
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
    async readCachedUserMessages(): Promise<DisplayableMessage[]> {
        if(this.cachedUserMessagesPromise == null) {
            this.cachedUserMessagesPromise = this.readUserMessages().then((result)=>{
                this.cachedUserMessages = result;
                this.cachedUserMessagesLoadedAll = false;
                return result;
            });
        }
        if(this.cachedUserMessages == null) await this.cachedUserMessagesPromise;
        return this.cachedUserMessages;
    }
    async readUserMessages(): Promise<DisplayableMessage[]> {
        var user = this.user;
        if(user === null) return [];        
        var client = this.getClient();
        var timeNow = Utils.utcTime();
        var result = await client.readUserMessages(user);
        if(!result.isSuccess()) throw result.getError();
        var messages = await this.toDisplayable(result);
        this.resolveReferences(messages);
        for(var displayableMessage of messages) {
            var conversation = displayableMessage.getConversation();
            var lastRead = this.conversationsLastReadData.lookup(conversation);
            if(lastRead == null) {
                lastRead = this.conversationsLastReadData.store(conversation, 0, 0);
            }
            if(this.selectedConversation === conversation) 
                this.setLastRead(conversation, displayableMessage.getTimestamp());
            else if(displayableMessage.getTimestamp() > lastRead.timestamp) {
                this.conversationsLastReadData.store(conversation, lastRead.timestamp, lastRead.number+1);
            }
        }
        return messages;
    }
    async readOnlineUsers(users: string[], verifyOnlineMessages: boolean = false): Promise<any> {
        var usersMap = {};        
        if(users.length === 0) return usersMap;
        var maxTime = Utils.utcTime()-7*60*1000; //7 minutes    
        var client = this.getClient();
        for(var user of users) usersMap[user] = null;
        var onlineResult = await client.readOnlineStatus(users, maxTime);
        if(onlineResult.isSuccess()) {
            var online = onlineResult.getResult();
            for(var json of online) {
                var username = json[1];
                var isOnline = false;
                try {
                    var message = SignableMessage.fromJSON(json);
                    if(!verifyOnlineMessages || (await message.verify())) {
                        var content = message.getContent();
                        if(content instanceof OnlineStatus) {
                            isOnline = content.isOnline();
                            (json as any).online = isOnline;
                        }
                    }
                }
                catch(e) { console.log(e); }
                usersMap[username] = isOnline;
            }
        }
        return usersMap;
    }
    async readOnlineUsersCommunity(community: string | Community, verifyOnlineMessages: boolean = false): Promise<any> {
        if(typeof community === 'string') community = await Community.load(community);
        var roles = community.listRoles();                
        var maxTime = Utils.utcTime()-7*60*1000; //7 minutes      
        var client = this.getClient();
        var onlineResult = await client.readOnlineStatusForCommunity(community.getName(), maxTime);
        if(onlineResult.isSuccess()) {
            var online = onlineResult.getResult();
            //var onlineMap = {};
            var role = {};
            var title = {};
            var added = {};
            var _online = [];
            for(var json of online) {
                var username = json[1];
                //onlineMap[username] = json;
                var isOnline = false;
                try {
                    var message = SignableMessage.fromJSON(json);
                    if(!verifyOnlineMessages || (await message.verify())) {
                        var content = message.getContent();
                        if(content instanceof OnlineStatus) {
                            isOnline = content.isOnline();
                            (json as any).online = isOnline;
                        }
                    }
                }
                catch(e) { console.log(e); }
                if(isOnline) {
                    added[username] = true;
                    if(roles[username] != null) {
                        var userRole = roles[username][1];
                        var userTitles = roles[username][2];
                        if(userRole != "") {
                            if(role[userRole] === undefined) role[userRole] = [];
                            role[userRole].push([username, userRole, userTitles, true]);
                        }
                        if(userTitles != null)
                            for(var userTitle of userTitles) {
                                if(title[userTitle] === undefined) title[userTitle] = [];
                                title[userTitle].push([username, userRole, userTitles, true]);
                            }
                    }
                    else {
                        _online.push([username, "", [], true]);
                    }
                }
            }
            for(var user in roles) {
                if(added[user]) continue;
                var roleData = roles[user];
                var userRole = roleData[1];
                var userTitles = roleData[2];
                if(userRole != "") {
                    if(role[userRole] === undefined) role[userRole] = [];
                    role[userRole].push([user, userRole, userTitles, false]);
                }
                if(userTitles != null)
                    for(var userTitle of userTitles) {
                        if(title[userTitle] === undefined) title[userTitle] = [];
                        title[userTitle].push([user, userRole, userTitles, false]);
                    }
            }
            return {role, title, online:_online};
        }
        return null;
    }
    async setupOnlineKey(storeLocally: boolean=false,
         onlinePrivateKey: string=null, onlinePublicKey: string=null,
         updatePrefs: boolean = false): Promise<CallbackResult> {
        var pref = await this.getPreferences();
        var onlineKey = await this.getKeyFor('$');        
        if(pref.getValue("$:s",null) == null || onlineKey == null) {
            if(onlinePrivateKey == null && onlinePublicKey == null) {
                var entropy = Utils.createRandomPassword()+Math.random();
                var privateK = Utils.dhive().PrivateKey.fromLogin(this.user, entropy, 'online' as any);
                var publicK = privateK.createPublic('STM');
                onlinePrivateKey = privateK.toString();
                onlinePublicKey = publicK.toString();
            }
            pref.setValue("$:s", onlinePublicKey);
            if(storeLocally) await this.storeKeyLocallyEncrypted('$', onlinePrivateKey);
            else return await this.storeKeyGloballyInPrivatePreferences('$', onlinePrivateKey);
        }
        if(updatePrefs) return await this.updatePreferences(pref);
        return null;
    }
    async setupOnlineStatus(enabled: boolean, storeLocally: boolean=false,
         onlinePrivateKey: string=null, onlinePublicKey: string=null): Promise<CallbackResult> {
        var pref = await this.getPreferences();
        pref.setValue("showOnline:b", enabled);
        if(enabled) {
            return await this.setupOnlineKey(storeLocally, onlinePrivateKey, onlinePublicKey, true);
        }
        return await this.updatePreferences(pref);
    }
    static setupOnlineStatusGenerateOnlineKey(user: string, pref: Preferences, privatePref: PrivatePreferences,
            onlinePrivateKey: string=null, onlinePublicKey: string=null) {
        pref.setValue("showOnline:b", true);
        if(onlinePrivateKey == null && onlinePublicKey == null) {
            var entropy = Utils.createRandomPassword()+Math.random();
            var privateK = Utils.dhive().PrivateKey.fromLogin(user, entropy, 'online' as any);
            var publicK = privateK.createPublic('STM');
            onlinePrivateKey = privateK.toString();
            onlinePublicKey = publicK.toString();
        }
        pref.setValue("$:s", onlinePublicKey);
        privatePref.setKeyFor('$', onlinePrivateKey);
    }
    async sendOnlineStatus(online: string, conversation: string = '$online'): Promise<CallbackResult> {
        var user = this.user;
        if(user === null) return null; 
        var onlineKey = await this.getKeyFor('$');
        if(onlineKey === null) {
            console.log("unknown key");
            return null;
        }
        var communities = [];
        var lastReadNum = await this.getLastReadTotal();
        var lastReadTimestamp = Utils.utcTime();
        var communities2 = await this.getCommunities(user);
        if(communities2 != null) 
            for(var community of communities2)
                communities.push(community[0]);
        var msg = SignableMessage.create(user, conversation, Content.onlineStatus(online, communities, lastReadNum, lastReadTimestamp), SignableMessage.TYPE_MESSAGE);
        msg.signWithKey(onlineKey, '$');
        var client = this.getClient();
        return await client.write(msg);
    }
    async sendMessage(msg: JSONContent, conversation: any, mentions: string[] = null,
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
                return null;
            }
        }
        
        var signableMessage = msg.forUser(user, conversation);
        if(mentions != null) signableMessage.setUserMentions(signableMessage.getUser(), mentions);
        await this.loginmethod.signMessage(signableMessage, keychainKeyType);
        if(encodeKey !== null) {
            var verified = await signableMessage.verify();
            if(!verified) throw "message did not verify";
            signableMessage.encodeWithKey(encodeKey);
        }
        var result = await client.write(signableMessage);
        return result;
    }
    async resolveUpvotes(message: DisplayableMessage, votesCallback: any = null, delay: number = 0) {
        var upvote = await this.findUpvoteForMessage(message.message);
        if(upvote) {
            var author = upvote[3];
            var link = upvote[4];
            message.upvotes = [];
            var promise = Utils.delay(delay).then(()=>{
                return Utils.getDhiveClient().database
                        .call('get_active_votes', [author, link]).then((votes)=>{
                    var arr = [];
                    for(var vote in votes)
                        arr.push(votes[vote].voter);
                    message.upvotes = arr;
                    if(votesCallback) votesCallback();
                });
            });
            message.upvoteLink = author+'/'+link;
        }
    }
    resolveReferences(messages: DisplayableMessage[]) {
        for(var msg of messages) this.resolveReference(messages, msg);
    }
    resolveReference(messages: DisplayableMessage[], msg: DisplayableMessage) {
        if(msg.reference != null) return;
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
                        else if(content instanceof Flag) {
                            m.flag(msg);
                        }
                        else msg.reference = m;
                        return;
                    }
                }
                //console.log("did not find reference ", content.getReference());
            }
        }
        catch(e) {
            console.log("error resolving reference ", msg, e);
        }
    }
    async toDisplayable(result: CallbackResult, asyncVerify: boolean = false): Promise<DisplayableMessage[]> {
        var list0: SignableMessage[] = [];
        var list: DisplayableMessage[] = [];
        var array = result.getResult();
        try {       
            var batchLoad = {}; 
            for(var msgJSON of array) {
                try {
                    var msg = SignableMessage.fromJSON(msgJSON);
                    if(msg.isSignedWithGroupKey()) {
                        var key = await this.getKeyFor(msg.getConversation());
                        if(key === null) {
                            console.log("key not found.");
                            continue;
                        }
                        msg.decodeWithKey(key);
                    }
                    list0.push(msg);
                    var user = msg.getUser();
                    if(!Utils.isGuest(user))
                        batchLoad[user] = true;
                }
                catch(e) {
                    console.log("Error parsing message: ", msgJSON);
                    console.log(e);
                }
            }
            var batchArray = Object.keys(batchLoad);
            if(batchArray.length > 0) Utils.preloadAccountData(batchArray); //no need to await
        }
        catch(e) {
            console.log("error preloading account data");
            console.log(e);
        }
        for(var msg of list0) {
            try {
                list.push(await this.signableToDisplayable(msg, asyncVerify));
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
    async jsonToDisplayable(msgJSON: any, asyncVerify: boolean = false): Promise<DisplayableMessage> {
        return await this.signableToDisplayable(SignableMessage.fromJSON(msgJSON), asyncVerify);
    }
    async signableToDisplayable(msg: SignableMessage, asyncVerify: boolean = false): Promise<DisplayableMessage> {
        if(msg.isSignedWithGroupKey()) {
            var key = await this.getKeyFor(msg.getConversation());
            if(key === null) throw 'key not found';
            msg.decodeWithKey(key);
        }
            
        var content = msg.getContent();

        if(content instanceof Encoded) {
            var decoded = this.popRecentlySentEncodedContent(content);
            if(decoded !== null) content = decoded;
            /*var decoded = await content.decodeWithKeychain(this.user, msg.getGroupUsernames());
            content = decoded;*/
        }
        
        var displayableMessage = new DisplayableMessage(msg);
        displayableMessage.content = content;
        if(asyncVerify) {
            displayableMessage.verified = null;
            setTimeout(()=>{
                msg.verify().then((result)=>{
                    displayableMessage.verified = result;
                });  
            },10);         
        }
        else {
            var verified = await msg.verify();
            displayableMessage.verified = verified;
        }
        displayableMessage.init();
        await this.resolveUpvotes(displayableMessage);
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
                        this.resolveReferences(data.messages);
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
