import { Client } from './client'
import { SignableMessage } from './signable-message'
import { DefaultStreamDataCache } from './default-stream-data-cache'

declare var dhive: any;
declare var window: any;

var keyChainRequest: Promise<any> = null;
var client: Client = null;
var dhiveclient = null;
var isNode = false;
var readPreferencesFn = null;
var lastRandomPublicKey = "";
var uniqueId = 0;
export class Utils {
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
                if(store.lookup(user) === undefined) 
                    usersToLoad.push(user);
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
                posting_json_metadata: result.posting_json_metadata
            });
    }
    static async getAccountData(user: string): Promise<any> {
        return await accountDataCache.cacheLogic(user,(user)=>{
            return Utils.getDhiveClient().database
                    .getAccounts([user]).then((array)=>{
                if(array.length === 1 && array[0].name === user) { 
                    return {
                        name: array[0].name,
                        posting: array[0].posting,
                        memo_key: array[0].memo_key,
                        posting_json_metadata: array[0].posting_json_metadata
                    };
                }
                return null;   
            });
        });
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
    static isWholeNumber(text: string) {
        return /^\d+$/.test(text);
    }
    static randomPublicKey(extraEntropy: string="") {
        var seed = extraEntropy+new Date().getTime()+lastRandomPublicKey+Math.random();
        var pi = dhive.PrivateKey.fromSeed(seed);
        var key = pi.createPublic("STM").toString();
        lastRandomPublicKey = key;
        return key;
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
    async cacheLogic(user: string, dataPromise: (user:string)=>Promise<any>): Promise<any> {
        //TODO cache for x time
        //TODO group many requests into one
        //TODO limit hive api calls
        var cachedData = this.lookup(user);
        if(cachedData !== undefined) {
            if(cachedData.value !== undefined) return cachedData.value;
            if(cachedData.promise !== undefined) {
                await cachedData.promise;
                return cachedData.value;
            }
        }
        var promise = dataPromise(user).then((result)=>{
            this.store(user, result);
            return result;   
        });
        this.storeLater(user, promise);
        return await promise; 
    }
}
const preferencesDataCache: AccountDataCache = new AccountDataCache();
const accountDataCache: AccountDataCache = new AccountDataCache();
const communityDataCache: AccountDataCache = new AccountDataCache();
var streamDataCache: DefaultStreamDataCache = null;




