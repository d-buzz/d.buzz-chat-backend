declare var dhive: any;

var client = null; 

export class Utils {
    static getClient() {
        if(client === null) client = new dhive.Client(["https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"]);
        return client;
    }   
    static setClient(dhiveClient: any) {
        client = dhiveClient;    
    } 
    static copy(object: any): any {
        return JSON.parse(JSON.stringify(object));
    }
    static utcTime(): number { return new Date().getTime(); }
    static async getAccountData(user: string): Promise<any> {
        return await accountDataCache.cacheLogic(user,(user)=>{
            return Utils.getClient().database
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
            return Utils.getClient().call("bridge", "get_community", [user]);
        });
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
const accountDataCache: AccountDataCache = new AccountDataCache();
const communityDataCache: AccountDataCache = new AccountDataCache();





