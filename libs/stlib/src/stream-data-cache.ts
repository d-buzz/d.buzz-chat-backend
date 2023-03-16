export class StreamDataCache {
    client: any = null
    isRunning: boolean = false
    customJSONCallbacks:any = {}
    modeType: number = 0
    constructor(dhiveClient: any, modeType: number = 0) {
        this.client = dhiveClient;
        this.modeType = modeType;
    }
    forCustomJSON(id: string, fn: (id: string, json: any, isPosting: boolean) => void) {
        this.customJSONCallbacks[id] = fn;
    }
    async begin() {
        try {
            this.isRunning = true;
            for await (const tx of this.getOps()) {
                if(!this.isRunning) return;
                var op = tx.op;
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
        finally {
            this.isRunning = false;
        }
    }
    async *getOps() {
        for await (const op of this.client.blockchain.getOperations(
            {mode: this.modeType})) {
            try { 
                yield op;
            }
            catch(e) {
                console.log(e);
            }
        }
    }
}
