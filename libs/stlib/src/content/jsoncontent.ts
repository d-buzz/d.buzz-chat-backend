import { SignableMessage, Encoded } from './imports'

declare var hive: any;
declare var hive_keychain: any;

export class JSONContent {
    json: any[]
    constructor(json: any[]) {
        this.json = json;
    }
    getType(): string { return this.json[0]; }
    toJSON(): any { return this.json; }
    encodeWithKey(user: string, groupUsers: string[], keytype: string, privateK: string, publicK: string): Encoded {
        groupUsers.sort();
        var string = JSON.stringify(this.json);            
        var encoded = [Encoded.TYPE, keytype.toLowerCase().charAt(0)];
        for(var groupUser of groupUsers) {      
            if(user === groupUser) { encoded.push(null); continue; }
            encoded.push(hive.memo.encode(privateK, publicK, "#"+string));
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
            if(user === groupUser) { encoded.push(null); continue; }
            var p = new Promise<string>((resolve, error)=>{
                    hive_keychain.requestEncodeMessage(user, groupUser,
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
}
