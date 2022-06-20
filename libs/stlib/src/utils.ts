declare var dhive: any;

var client = null; 

export class Utils {
    static getClient() {
        if(client === null) client = new dhive.Client(["https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"]);
        return client;
    }    
    static utcTime(): number { return new Date().getTime(); }
    static async getAccountData(user: string): Promise<any> {
        var a = await Utils.getClient().database.getAccounts([user]);
        if(a.length === 1 && a[0].name === user) { //TODO cache results for x time
            return a[0];
        }
        return null; 
    }
}

