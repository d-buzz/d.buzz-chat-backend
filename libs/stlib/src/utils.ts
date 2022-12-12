import { Client } from './client'
import { SignableMessage } from './signable-message'
import { DefaultStreamDataCache } from './default-stream-data-cache'

declare var dhive: any;
declare var window: any;

var netname = null;
var guestAccountValidators = [];
var keyChainRequest: Promise<any> = null;
var client: Client = null;
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
    static getDhiveClient() {
        if(dhiveclient === null) dhiveclient = new dhive.Client(["https://api.hive.blog", "https://anyx.io", "https://api.openhive.network", "https://rpc.ecency.com"]);
        return dhiveclient;
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
                fn(keychain, resolve, error);
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
    static getConversationUsername(conversation: string): string {
        var i = conversation.indexOf('/'); 
        return conversation.substring(conversation.startsWith('#')?1:0, i===-1?conversation.length:i);
    }
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
                            if(Utils.isGuest(msg.getUser())) {

                            }
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
        }, 25);
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
    static async getCommunityData(user: string): Promise<any> {
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
    static parseGroupConversation(conversation: string): any[] {
        var array: any[] = Utils.parseConversation(conversation);
        if(array.length !== 3 || array[0] !== '#' || !Utils.isWholeNumber(array[2])) return null;
        array[2] = Number.parseInt(array[2]);
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
    static isWholeNumber(text: string) {
        return /^\d+$/.test(text);
    }
    static isGuest(user: string) {
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
    static randomPublicKey(extraEntropy: string="") {
        var seed = extraEntropy+new Date().getTime()+lastRandomPublicKey+Math.random();
        var pi = dhive.PrivateKey.fromSeed(seed);
        var key = pi.createPublic("STM").toString();
        lastRandomPublicKey = key;
        return key;
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
        finally {
            if(batch === this.batch) {
                this.batch = null;
                this.batchPromise = null;          
            }
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
 



