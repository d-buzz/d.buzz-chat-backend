
declare var dhive: any;

export class StreamDataCache {
    client: any = null
    isRunning: boolean = false;
    customJSONCallbacks:any = {};
    constructor(dhiveClient: any) {
        this.client = dhiveClient;
    }
    forCustomJSON(id: string, fn: (id: string, json: any, isPosting: boolean) => void) {
        this.customJSONCallbacks[id] = fn;
    }
    async begin() {
        for await (const op of this.getOps()) {
            var opName = op[0];
            if(opName === "custom_json") {
                var customJSON = op[1];
                var id = customJSON.id
                var fnJSON = this.customJSONCallbacks[id];
                if(fnJSON) {
                    var json = JSON.parse(customJSON.json);
                    var auths = customJSON.required_auths;
                    var postingAuths = customJSON.required_posting_auths;
                    for(var user of auths)
                        fnJSON(user,json,false);
                    for(var user of postingAuths)
                        fnJSON(user,json,true);
                }
            }
        }
    }
    async *getOps() {
        for await (const op of this.client.blockchain.getOperations(
            {mode: dhive.BlockchainMode.Irreversible})) {
            try { 
                yield op;
            }
            catch(e) {
                console.log(e);
            }
        }
    }
    
}
