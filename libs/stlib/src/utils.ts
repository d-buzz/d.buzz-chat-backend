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
    static utcTime(): number { return new Date().getTime(); }
    static async getAccountData(user: string): Promise<any> {
        //TODO cache for x time
        //TODO group many requests into one
        //TODO limit hive api calls
        var cachedData = accountDataCache.lookup(user);
        if(cachedData !== undefined) {
            if(cachedData.value !== undefined) return cachedData.value;
            if(cachedData.promise !== undefined) {
                await cachedData.promise;
                return cachedData.value;
            }
        }

        var promise = Utils.getClient().database.getAccounts([user])
            .then((array)=>{
                if(array.length === 1 && array[0].name === user) { 
                    var accountData = array[0];
                    var cachedData = {
                        name: array[0].name,
                        posting: array[0].posting,
                        memo_key: array[0].memo_key,
                    };
                    accountDataCache.store(user, cachedData);
                    return cachedData;
                }
                accountDataCache.store(user, null);
                return null;   
        });
        accountDataCache.storeLater(user, promise);
        return await promise; 
    }
}
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
}
const accountDataCache: AccountDataCache = new AccountDataCache();






