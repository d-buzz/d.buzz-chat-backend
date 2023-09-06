import { Utils } from './utils'

export class StreamDataCache {
    client: any = null
    isRunning: boolean = false
    stmsgCallback: any = null
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
            var stmsgCallback;
            for await (const tx of this.getOps()) {
                if(!this.isRunning) return;
                var op = tx.op;
                var opName = op[0];
                if(opName === "comment_options" && (stmsgCallback=this.stmsgCallback)) {
                    var options = op[1];
                    if(options.allow_votes && options.extensions.length > 0 
                         && options.permlink.startsWith("stmsg--")) {
                        for(var extention of options.extensions) {
                            if(extention[0] === 'comment_payout_beneficiaries') {
                                var beneficiaries = extention[1];
                                if(beneficiaries.beneficiaries && beneficiaries.beneficiaries.length === 1) {
                                    var beneficiary = beneficiaries.beneficiaries[0];
                                    if(beneficiary.weight === 10000) {
                                        var parts = Utils.decodeUpvotePermlink(options.permlink);
                                        if(parts !== null) {
                                            parts.push(options.author);
                                            parts.push(options.permlink);
                                            parts.push(new Date(tx.timestamp+"Z").getTime());
                                            stmsgCallback(parts);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else if(opName === "custom_json") {
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
