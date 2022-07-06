import { Client } from './client'
import { SignableMessage } from './signable-message'

declare var dhive: any;

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
                return new Promise((ok,error)=>{
                    Utils.getClient().readPreferences(user, async (result)=>{
                        if(result.isSuccess()) {
                            var result = result.getResult();
                            if(result === null) ok(null);
                            else {
                                var msg = SignableMessage.fromJSON(result);
                                var verify = await msg.verify();
                                if(verify) {
                                    ok(msg.getContent());
                                }
                                else error("preferences did not verify");
                            }
                        }
                        else error(result.getError());
                    });
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





