import { Client } from './client'
import { SignableMessage } from './signable-message'

declare var dhive: any;
declare var window: any;

var keyChainRequest: Promise<any> = null;
var client: Client = null;
var dhiveclient = null;
var isNode = false;
var readPreferencesFn = null;
var lastRandomPublicKey = "";
export class Utils {
    static getVersion() { return 100; }
    static getClient(): Client {
        return client;
    } 
    static setClient(_client: Client): void {
        client = _client;    
    } 
    static getDhiveClient() {
        if(dhiveclient === null) dhiveclient = new dhive.Client(["https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"]);
        return dhiveclient;
    }
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
            return Utils.getDhiveClient().call("bridge", "get_community", [user]);
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





