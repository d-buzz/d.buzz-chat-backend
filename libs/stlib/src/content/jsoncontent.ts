import { SignableMessage, Encoded, Utils } from './imports'

declare var hive: any;

export class JSONContent {
    json: any[]
    constructor(json: any[]) {
        this.json = json;
    }
    getType(): string { return this.json[0]; }
    toJSON(): any { return this.json; }
    copy(): any { return new (this.constructor as typeof JSONContent)(JSON.parse(JSON.stringify(this.json)));}
    async encodeWithKey(user: string, groupUsers: string[], keytype: string, privateK: string, publicK: string = null): Promise<Encoded> {
        groupUsers.sort();
        var string = JSON.stringify(this.json);            
        var encoded = [Encoded.TYPE, keytype.toLowerCase().charAt(0)];
        for(var groupUser of groupUsers) {      
            if(user === groupUser) { encoded.push(null); continue; }
            var puKey = publicK;
            if(puKey == null) {
                var accountData = await Utils.getAccountData(groupUser);
                if(accountData == null) throw "error could not find public key of user: " + groupUser;
                puKey = accountData.posting.key_auths[0][0];
            }
            encoded.push(hive.memo.encode(privateK, puKey, "#"+string));
        }
        return new Encoded(encoded);
    }
    async encodeWithKeychain(user: string, groupUsers: string[], 
            keychainKeyType: string): Promise<Encoded> {
        if(this instanceof Encoded) return this;
        var string = JSON.stringify(this.json);

        groupUsers.sort();
        var encoded = [Encoded.TYPE, keychainKeyType.toLowerCase().charAt(0)];
        for(var groupUser of groupUsers) {      
            if(groupUsers.length > 1 && user === groupUser) { encoded.push(null); continue; }
            var p = Utils.queueKeychain((keychain, resolve, error)=>{
                    keychain.requestEncodeMessage(user, groupUser,
                        "#"+string, keychainKeyType, (result)=>{
                        if(result.success) {
			                resolve(result.result);
		                }
		                else error(result);
                    });
                });
            encoded.push(await p);
        }
        if(encoded.length === 2) return null;
        return new Encoded(encoded);
    }     
    forUser(user: string, conversation: string | string[]): SignableMessage {
        return SignableMessage.create(user, conversation, this.json);
    }
    isEqual(content: JSONContent): boolean {
        var js0 = this.json;
        var js1 = content.json;
        if(js0.length !== js1.length) return false;
        for(var i = 0; i < js0.length; i++)
            if(js0[i] !== js1[i]) return false;
        return true;
    }
}
