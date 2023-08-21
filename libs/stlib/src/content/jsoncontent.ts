import { SignableMessage, Encoded, Utils } from './imports'

/**
 * JSONContent represents content in the form of json array.
 *
 * The first element of json array contains a unique name of the type.
 * This class can be extended to create custom types.
 * 
 * An example of class extending this class is Text type.
 *
 * class Text extends JSONContent {
 *   static readonly TYPE:string = "t";
 *   constructor(json: any[]) { super(json); }
 *   getText(): string { return this.json[1]; }    
 *   setText(text: string) { this.json[1] = text; } 
 * } 
 * 
 * {@see Content.addType} 
 */
export class JSONContent {
    json: any[]
    constructor(json: any[]) {
        this.json = json;
    }
    /**
     * Returns the type of this content.
     */
    getType(): string { return this.json[0]; }
    /**
     * Returns this content as json array.
     */
    toJSON(): any { return this.json; }
    /**
     * Creates a copy of this content.
     */
    copy(): any { return new (this.constructor as typeof JSONContent)(JSON.parse(JSON.stringify(this.json)));}
    /**
     * Encodes the content with key for each user in groupUsers except user.
     */
    async encodeWithKey(user: string, groupUsers: string[], keytype: string, privateK: any, publicK: any = null): Promise<Encoded> {
        groupUsers.sort();
        var string = JSON.stringify(this.json);            
        var encoded = [Encoded.TYPE, keytype.toLowerCase().charAt(0)];
        for(var groupUser of groupUsers) {      
            if(user === groupUser) { encoded.push(null); continue; }
            var puKey = publicK;
            if(puKey == null) {
                puKey = await Utils.getPreferredKey(groupUser);
                if(puKey == null) throw "error could not find public key of user: " + groupUser;
            }
            encoded.push(Utils.encodeTextWithKey(string, privateK, puKey));
        }
        return new Encoded(encoded);
    }
    /**
     * Encodes this content for each user in groupUsers except user with keychain.
     */
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
    /**
     * Creates a SignableMessage to be signed with user and posted in conversation with this content.
     */
    forUser(user: string, conversation: string | string[]): SignableMessage {
        return SignableMessage.create(user, conversation, this.json);
    }
    /**
     * Returns true if this content and content are equal.
     */
    isEqual(content: JSONContent): boolean {
        var js0 = this.json;
        var js1 = content.json;
        if(js0.length !== js1.length) return false;
        for(var i = 0; i < js0.length; i++)
            if(js0[i] !== js1[i]) return false;
        return true;
    }
}
