import { Client } from './client'
import { Community } from './community'
import { SignableMessage } from './signable-message'
import { DefaultStreamDataCache } from './default-stream-data-cache'

declare var hive: any;
declare var dhive: any;
declare var window: any;

var netname = null;
var guestAccountValidators = [];
var keyChainRequest: Promise<any> = null;
var client: Client = null;
var _dhive = null;
var secureRandomFn = null;
var dhiveclient = null;
var isNode = false;
var readPreferencesFn = null;
var lastRandomPublicKey = "";
var uniqueId = 0;
export class Utils {
    static GUEST_CHAR = '@';
    /*
        Netname is an unique identifier of the network shared between
        all nodes to determine whether they belong to each other.
        Format: name[publickey,account1,account2]
        where name is the name of the network
        the part in [] is optional and provides a comma separated list of
        either public keys or accountnames with the ability to validate 
        guest account creation requests.
    */
    static setNetworkname(name) { 
        netname = name;
        var from = name.indexOf('[');
        if(from === -1) return [];
        var to = name.lastIndexOf(']');
        guestAccountValidators = name.substring(from+1, to).trim().split(/[, ]+/); 
    }
    static getNetworkname() { return netname; }
    static getGuestAccountValidators() { return guestAccountValidators; }
    static getVersion() { return 3; }
    static getClient(): Client {
        return client;
    } 
    static setClient(_client: Client): void {
        client = _client;    
    }
    static setDhive(dhive0) {
        _dhive = dhive0;
    }
    static dhive() {
        if(_dhive === null) { 
            var dhive0 = dhive?dhive:null;
            if(dhive0 != null) _dhive = dhive0; 
        }
        return _dhive;
    }
    static getDhiveClient() {
        if(dhiveclient === null) {
            var dhiveClient = Utils.dhive().Client;
            dhiveclient = new dhiveClient(["https://api.hive.blog", "https://anyx.io", "https://api.openhive.network", "https://rpc.ecency.com"]);
        }
        return dhiveclient;
    }
    static reputation(value) { 
        if(value == null || value === 0) return 25;
        var neg = value < 0;
        var rep = Math.abs(value);
        var v = Math.log10((rep > 0 ? rep : -rep) - 10) - 9;
        v = neg ? -v : v;
        return v * 9 + 25;
    }
    static Buffer() { return Utils.dhive().NETWORK_ID.constructor; }
    static setSecureRandom(fn) {
        secureRandomFn = fn;
    }
    static randomBytes(len) {
        var bytes = null;        
        if(window != null && window.crypto != null && window.crypto.getRandomValues != null) {
            bytes = window.crypto.getRandomValues(new Uint8Array(len)); 
        }
        else bytes = secureRandomFn(len);
        return bytes;
    }
    static createRandomPassword(): string {
        return Utils.dhive().cryptoUtils.sha256(Utils.randomBytes(32)).toString();
    }
    static randomPublicKey(extraEntropy: string="") {
        var seed = extraEntropy+new Date().getTime()+lastRandomPublicKey+Math.random();
        var pi = Utils.dhive().PrivateKey.fromSeed(seed);
        var key = pi.createPublic("STM").toString();
        lastRandomPublicKey = key;
        return key;
    }
    static encodeTextWithKey(text: string, privateK: any, publicK: any): string {
        //return Utils.dhive().Memo.encode(privateK, publicK, '#'+text);
        return hive.memo.encode(privateK.toString(), publicK.toString(), '#'+text);
    }
    static decodeTextWithKey(text: string, privateK: any): string {
        //var decoded = Utils.dhive().Memo.decode(privateK, text);
        var decoded = hive.memo.decode(privateK.toString(), text);
        if(decoded.startsWith("#")) decoded = decoded.substring(1);
        return decoded;
    }
    static nextId() { return uniqueId++;}
    /* Queue keychain requests. */
    static async queueKeychain(fn): Promise<any> {
        var keychain = window.hive_keychain;
        if(keychain == null) throw 'keychain not found';
        var length = Object.keys(keychain.requests).length;
        if(keyChainRequest !== null) {
            if(length > 0) {
                console.log("warning: keychain already opened");
            }
            await keyChainRequest;
            if(keyChainRequest !== null) { console.log("error queueKeychain"); }
        }
        var p = new Promise<any>((resolve, error)=>{
            try {
                setTimeout(()=>{
                    fn(keychain, resolve, error);
                }, 50);
            }
            catch(e) {
                console.log(e);
                error(e);            
            }
        });
        try {
            keyChainRequest = p;
            var result = await p;
        }
        finally {
            keyChainRequest = null;
        }
        return result;
    }
    static setDhiveClient(dhiveClient: any): void {
        dhiveclient = dhiveClient;    
    } 
    static setNode(_isNode: boolean): void {
        isNode = _isNode;
    }
    static setReadPreferenceFunction(fn: any): void {
        readPreferencesFn = fn;
    } 
    static copy(object: any): any {
        return JSON.parse(JSON.stringify(object));
    }
    static utcTime(): number { return new Date().getTime(); }
    static getConversationPath(conversation: string): string {
        var i = conversation.indexOf('/'); 
        return i===-1?'':conversation.substring(i+1);
    }
    static async getGroupName(conversation: string): Promise<string> {
        if(!conversation.startsWith('#')) return conversation;
        var username = Utils.getConversationUsername(conversation);
        var path = Utils.getConversationPath(conversation);
        var pref = await Utils.getAccountPreferences(username);
        var groups = pref.getGroups();
        var group = groups[path];
        return (group !== null && group.name != null)?group.name:conversation;
    }
    static async getGroupKey(conversation: string): Promise<string> {
        try {
            if(!conversation.startsWith('#')) return conversation;
            var username = Utils.getConversationUsername(conversation);
            var path = Utils.getConversationPath(conversation);
            var pref = await Utils.getAccountPreferences(username);
            var groups = pref.getGroups();
            var group = groups[path];
            return (group !== null && group.key != null)?group.key:null;
        }
        catch(e) { console.log(e); }
        return null;
    }
    static async getGroupTimestamp(conversation: string): Promise<number> {
        try {
            if(!conversation.startsWith('#')) return 0;
            var username = Utils.getConversationUsername(conversation);
            var path = Utils.getConversationPath(conversation);
            var pref = await Utils.getAccountPreferences(username);
            var groups = pref.getGroups();
            var group = groups[path];
            return (group !== null && group.time != null)?group.time:0;
        }
        catch(e) { console.log(e); }
        return 0;
    }
    static async getRole(community: string, user: string): Promise<string> {
        var data = await Community.load(community);
        if(!data) return null;
        return data.getRole(user);
    }
    static async getTitles(community: string, user: string): Promise<string[]> {
        var data = await Community.load(community);
        if(!data) return null;
        return data.getTitles(user);
    }
    static async getFlagNum(community: string, user: string): Promise<number> {
        var data = await Community.load(community);
        if(!data) return null;
        return data.getFlagNum(user);
    }
    static async verifyPermissions(user: string, conversation: string): Promise<boolean> {
        if(Utils.isCommunityConversation(conversation)) {
            var communityName = Utils.getConversationUsername(conversation);
            var communityStreamId = conversation.substring(communityName.length+1);
            var community = await Community.load(communityName);
            if(community == null) return false;
            var stream = community.findTextStreamById(communityStreamId);
            if(stream !== null) {
                if(community.getRole(user) === 'muted') return false;
                var writePermissions = stream.getWritePermissions();
                if(!writePermissions.isEmpty()) {
                    var role, titles;
                    if(Utils.isGuest(user)) {
                        role = "";
                        titles = [];
                    }
                    else {
                        role = await Utils.getRole(communityName, user);
                        titles = await Utils.getTitles(communityName, user);
                    }
                    if(!writePermissions.validate(role, titles)) 
                        return false;
                }
            }
        }
        else if(Utils.isGroupConversation(conversation)) {
            var groupUsernames = Utils.getGroupUsernames(conversation);
            for(var groupUsername of groupUsernames) {
                if(groupUsername === user) continue;
                var canDirectMessage = await Utils.canDirectMessage(groupUsername, groupUsernames);
                if(!canDirectMessage) return false;
            }
        }
        return true;  
    }
    static getConversationUsername(conversation: string): string {
        var i = conversation.indexOf('/'); 
        return conversation.substring(conversation.startsWith('#')?1:0, i===-1?conversation.length:i);
    }
    static isJoinableGroupConversation(conversation: string): boolean {
        if(conversation === '' || conversation[0] != '#') return false;
        var i = conversation.indexOf('/');
        return i !== -1;
    }
    static getGroupUsernames(conversation: string): string[] { return conversation.split('|'); }
    static isCommunityConversation(conversation: string): boolean { return conversation.startsWith('hive-') && conversation.indexOf('/') !== -1;}
    static isGroupConversation(conversation: string): boolean { return conversation.indexOf('|') !== -1; }
    static async canDirectMessage(user: string, users: string[]): Promise<boolean> {
        //TODO
        var pref = await Utils.getAccountPreferences(user);
        if(pref != null) {
            var option = pref.getValueString("directMessage", null);
            if(option != null) {
                //values: 'everyone' 'accounts' 'communities' 'friends'
                if(option === 'accounts') {
                    for(var name of users) if(Utils.isGuest(name)) return false;
                }
                else if(option === 'communities') {}
                else if(option === 'friends') {}
            }
        }
        return true;
    }
    static async getAccountPreferences(user: string): Promise<any> {
        if(isNode) {
            return await readPreferencesFn(user);
        }
        else {
            if(Utils.getClient() == null) 
                throw 'client is null, use Utils.setClient(...) to initialize.';
            return await preferencesDataCache.cacheLogic(user,(user)=>{
                return Utils.getClient().readPreferences(user).then(async (res)=>{
                    if(res.isSuccess()) {
                        var result = res.getResult();
                        if(result === null) return null;
                        else {
                            var msg = SignableMessage.fromJSON(result);
                            /*if(Utils.isGuest(msg.getUser())) {

                            }*/
                            var verify = await msg.verify();
                            if(verify) {
                                return msg.getContent();
                            }
                            else throw "preferences did not verify";
                        }
                    }
                    else throw res.getError();
                    throw "failed to load";
                });
            });
        }
    }
    static async preloadAccountData(users: string[], reload: boolean = false): Promise<void> {
        var store = accountDataCache;
        var usersToLoad = users;
        if(!reload) {
            usersToLoad = [];
            for(var user of users) {
                if(store.lookup(user) === undefined && !Utils.isGuest(user)) {
                    usersToLoad.push(user);
                }
            }
        }
        if(usersToLoad.length === 0) return;
        var p = Utils.getDhiveClient().database.getAccounts(usersToLoad);
        for(var user of usersToLoad)
            store.storeLater(user, p);
        var array = await p;
        for(var result of array)
            store.store(result.name, {
                name: result.name,
                posting: result.posting,
                memo_key: result.memo_key,
                posting_json_metadata: result.posting_json_metadata,
                created: result.created,
                reputation: result.reputation
            });
    }
    static async getPreferredKey(_user: string): Promise<any> {
        var data = await Utils.getAccountData(_user);
        if(data == null) return null;
        if(Utils.isGuest(_user)) return data.posting.key_auths[0][0];
        var usePostingKey = true;        
        /*try { 
            var prefs = Utils.getAccountPreferences(_user);
            if(prefs && prefs.getValueBoolean("memoKey", false)) 
                usePostingKey = false;              
        }
        catch(e) { console.log(e); }*/
        return usePostingKey?data.posting.key_auths[0][0]:data.memo_key;        
    }
    static async getAccountData(_user: string): Promise<any> {
        if(Utils.isGuest(_user)) {
            var preferences = await Utils.getAccountPreferences(_user);
            if(preferences) {
                var account = preferences.getAccount();
                if(account && account.message && account.message.length >= 7) {
                    var message = account.message;
                    return {
                        message: message,
                        name: message[2],
                        posting: {key_auths:[[message[3],1]]},
                        memo_key: '',
                        posting_json_metadata: '',
                        created: new Date(message[4]).toISOString(),
                        reputation: 0
                    };
                }
            }
            return null;
        }
        return await Utils.getHAccountData(_user);
    }
    static async getHAccountData(_user: string): Promise<any> {
        return await accountDataCache.cacheLogic(_user,(user)=>{
            if(!Array.isArray(user)) user = [user];
            return Utils.getDhiveClient().database
                    .getAccounts(user).then((array)=>{
                var result = {};
                for(var i = 0; i < array.length; i++) {
                    result[array[i].name] = {
                        name: array[i].name,
                        posting: array[i].posting,
                        memo_key: array[i].memo_key,
                        posting_json_metadata: array[i].posting_json_metadata,
                        created: array[i].created,
                        reputation: array[i].reputation
                    };
                }
                return result;
            });
        }, 100);
    }
    static async delay(ms: number): Promise<any> { return new Promise(r=>{setTimeout(r, ms);}); }
    static async retrieveAll(api: string, method: string, params: any, delayMs: number = 500) {
        var array = [];
        var limit = params.limit;
        if(!(limit > 0)) return array;
        var users = {};
        while(true) {
            var result = await Utils.getDhiveClient().call(api, method, params);
            for(var a of result) array.push(a);
            if(!(result.length > 0) || result.length < limit) return array;
            var added = false;
            for(var a of result) {
                var item = Array.isArray(item)?item[0]:item;
                if(users[item] === undefined) {
                    added = true;
                    users[item] = item;
                }
            }
            if(!added) return array;
            var lastItem = array[array.length-1];
            params.last = Array.isArray(lastItem)?lastItem[0]:lastItem;
            await Utils.delay(delayMs);
        }
    }
    static async getCommunityData(user: string, loadFromNode: boolean = true): Promise<any> {
        if(isNode || !loadFromNode) {
            return await communityDataCache.cacheLogic(user,(user)=>{
                return Utils.getDhiveClient().call("bridge", "get_community", [user]).then(async (result)=>{
                    var array = await Utils.getDhiveClient().call("bridge", "list_community_roles", [user]);
                    result.roles = {};
                    if(Array.isArray(array))
                        for(var role of array) {
                            role[2] = role[2] === ""?[]:role[2].split(",");
                            result.roles[role[0]] = role;
                        }
                    return result;
                });
            });
        }
        else {
            if(Utils.getClient() == null) 
                throw 'client is null, use Utils.setClient(...) to initialize.';
            return await communityDataCache.cacheLogic(user,(user)=>{
                return Utils.getClient().readCommunity(user).then(async (res)=>{
                    if(res.isSuccess()) {
                        var result = res.getResult();
                        if(result == null) return null;
                        if(result[1] != null) result[0].joined = result[1];
                        return result[0];
                    }
                    else throw res.getError();
                });
            }); 
        }
    }
    static async findGroupInfo(conversation: string): Promise<any> {
        var groupConversation = Utils.parseGroupConversation(conversation);
        if(groupConversation == null) return null;
        var prefs = await Utils.getAccountPreferences(groupConversation[1]);
        if(prefs == null) return null;
        return prefs.getGroup(groupConversation[2]);
    }
    static parseGroupConversation(conversation: string): any[] {
        var array: any[] = Utils.parseConversation(conversation);
        if(array.length !== 3 || array[0] !== '#' || !Utils.isWholeNumber(array[2])) return null;
        try {
            array[2] = Number.parseInt(array[2]);
        }
        catch(e) { return null; }
        return array;
    }
    static parseConversation(conversation: string): string[] {
        var result = [];
        if(conversation.startsWith('#')) {
            result.push('#');
            conversation = conversation.substring(1);
        }
        var slash = conversation.indexOf('/');
        if(slash === -1) result.push(conversation);
        else {
            result.push(conversation.substring(0, slash));
            result.push(conversation.substring(slash+1));
        }
        return result;
    }
    static isWholeNumber(text: string): boolean {
        return /^\d+$/.test(text);
    }
    static isGuest(user: string): boolean {
        return user.indexOf(Utils.GUEST_CHAR) !== -1;
    }
    static parseGuest(guestName: string): string[] {
        var i = guestName.indexOf(Utils.GUEST_CHAR);
        if(i === -1) return [guestName];
        return [guestName.substring(0, i), guestName.substring(i+1)];
    }
    static isValidGuestName(guestName: string): boolean {
        if(guestName.length > 20) return false;
        var i = guestName.indexOf(Utils.GUEST_CHAR);
        var username = (i === -1)?guestName:guestName.substring(0, i);
        var number = (i === -1)?null:guestName.substring(i+1);
        if(username.length <= 2 || username.length > 16) return false;
        if(number !== null && (number.length <= 0 || !Utils.isWholeNumber(number))) return false;
        return /^[A-Za-z0-9-._]*$/.test(username);
    }
    static xorArray(a: number[], b: number[], result: number[] = null): number[] {
        var length = Math.min(a.length, b.length);
        if(result === null) result = new Array(length).fill(0);
        for(var i = 0; i < length; i++) result[i] = a[i]^b[i];
        return result;
    }
    static arrayEquals(a: any[], b: any[]): boolean {
        if(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for(var i = 0; i < a.length; i++) if(a[i] !== b[i]) return false;        
        return true;
    }
    static newCache() {
        return new AccountDataCache();
    }
    static getAccountDataCache() { return accountDataCache; }
    static getCommunityDataCache() { return communityDataCache; }
    static getStreamDataCache() { 
        if(streamDataCache === null)
            streamDataCache = new DefaultStreamDataCache();
        return streamDataCache;
    }

}
export class TransientCache {
    duration: number
    binDuration: number
    items: any = {}
    newBinInstanceFn: any
    
    constructor(duration: number, binDuration: number, newBinInstanceFn: any) {
        this.duration = duration;
        this.binDuration = binDuration;
        this.newBinInstanceFn = newBinInstanceFn;
    }  
    binTime(time: number) {
        return time-time%this.binDuration;
    }
    get(time: number, createIfNotPresent: boolean = true) {
        var now = Utils.utcTime();        
        var ti = this.binTime(time);
        if(now-this.duration > ti) return null;
        var bin = this.items[ti];
        if(bin === undefined) {
            if(createIfNotPresent) this.items[ti] = bin = this.newBinInstanceFn();
            else bin = null;
        }
        return bin;
    }    
    add(time: number, item: any) {
        var bin = this.get(time);
        if(bin == null) return null;
        bin.add(time, item);
        return bin;
    }
    deleteOldEntries() {
        var now = Utils.utcTime();        
        for(var ti in this.items)
            if(now-this.duration > Number(ti)) 
                delete this.items[ti];
    }
}
/*
TODO a simple cache for now
will have to discuss and redesign later
server will most likely prefer to have up to date data
it could do that by streaming blocks from hive

on the other hand client might prefer to cache
account and community data for X time
*/
export class AccountDataCache {
    data: any = {}
    batch: string[] = null
    batchPromise: any = null
    
    lookup(user: string): any {
        return this.data[user];
    }
    lookupValue(user: string): any {
        var item = this.data[user];
        if(item === undefined) return undefined;
        return item.value;
    }
    reload(user: string): any {
        var cachedData = this.lookup(user);
        if(cachedData !== undefined) {
            if(cachedData.value !== undefined) delete this.data[user];
        }
    }
    storeLater(user: string, promise: Promise<any>) {
        this.data[user] = { promise };         
    }
    store(user: string, value: any) {
        if(this.data[user] === undefined)
            this.data[user] = {value};
        else {
            delete this.data[user].promise;
            this.data[user].value = value;
        }
    }
    async callBatched(dataPromise: (user:any)=>Promise<any>, batch: string[] = this.batch) {
        try {
            this.batch = null;
            this.batchPromise = null;    
            var results = await dataPromise(batch);
            for(var i = 0; i < batch.length; i++) {
                var user = batch[i];
                var result = results[user];
                if(result !== undefined)               
                    this.store(user, result);
            }            
        }
        catch(e) {
            console.log(e);
        }
    }
    async cacheLogic(user: string, dataPromise: (user:any)=>Promise<any>,
        aggregate:number=1): Promise<any> {
        //TODO cache for x time
        var cachedData = this.lookup(user);
        if(cachedData !== undefined) {
            if(cachedData.value !== undefined) return cachedData.value;
            if(cachedData.promise !== undefined) {
                await cachedData.promise;
                return cachedData.value;
            }
        }
        var promise;
        if(aggregate > 1) {
            var _this = this;
            var batch = this.batch;
            var batchPromise = this.batchPromise;
            while(batch != null && batch.length === aggregate && batchPromise != null) {
                await batchPromise;
                if(batchPromise === this.batchPromise) {
                    console.log("error cacheLogic");
                    break;
                }
                batch = this.batch;
                batchPromise = this.batchPromise;
            }
            if(batch == null) {
                this.batch = batch = [user];
                this.batchPromise = new Promise((resolve)=>{
                    (batch as any).resolve = resolve;
                    setTimeout(resolve, 10);
                }).then(async ()=>{
                    await _this.callBatched(dataPromise, batch);
                });
                this.batchPromise.resolve = (batch as any).resolve;
            }
            else if(batch.indexOf(user) === -1) {
                batch.push(user);
            }
            batchPromise = this.batchPromise;
            if(batch.length === aggregate) {
                batchPromise.resolve();
                await batchPromise;
                return this.lookupValue(user);
            }   
            promise = new Promise(async (resolve)=> {
                await batchPromise;
                resolve(_this.lookupValue(user));
            });
        }
        else { 
            promise = dataPromise(user).then((result)=>{
                this.store(user, result);
                return result;   
            });
        }
        this.storeLater(user, promise);
        return await promise; 
    }
}
const preferencesDataCache: AccountDataCache = new AccountDataCache();
const accountDataCache: AccountDataCache = new AccountDataCache();
const communityDataCache: AccountDataCache = new AccountDataCache();
var streamDataCache: DefaultStreamDataCache = null;
 



