import {Content, SignableMessage, JSONContent } from './imports'

declare var hive: any;
declare var hive_keychain: any;

export class Encoded extends JSONContent {
    static readonly TYPE:string = "x";

    constructor(json: any[]) { super(json); }
    isEncodedWithMemo(): boolean { return this.json[1] === "m";}
    isEncodedWithPosting(): boolean { return this.json[1] === "p";}
    decodeWithKey(user: string, groupUsers: string[], privateK: string): JSONContent {
        groupUsers.sort();
        var messageIndex = groupUsers.indexOf(user);
        if(messageIndex === -1) return null;
        var text = this.json[messageIndex+2];
        var string = hive.memo.decode(privateK, text);
        if(string.startsWith("#")) string = string.substring(1);
        return Content.fromJSON(JSON.parse(string));
    }
    async decodeWithKeychain(user: string, groupUsers: string[]): Promise<JSONContent> {
        groupUsers.sort();
        var keyType = this.json[1];
        var keychainKeyType = keyType==="p"?"Posting"
                :(keyType==="m"?"Memo":null);
        if(keychainKeyType === null) return null;
        var messageIndex = groupUsers.indexOf(user);
        if(messageIndex === -1) return null;
        var text = this.json[messageIndex+2];
        if(text === null) text = this.json[messageIndex===0?3:2];    
        var p = new Promise<string>((resolve, error)=>{
            hive_keychain.requestVerifyKey(user, text, keychainKeyType,
                (result)=>{
                if(result.success) {
                    var string = result.result;
                    if(string.startsWith("#")) string = string.substring(1);
	                resolve(string);
                }
                else error(result);
            });
        });
        var json = await p;
        return Content.fromJSON(JSON.parse(json));
    }
}
