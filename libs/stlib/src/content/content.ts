import { 
    SignableMessage, JSONContent, Encoded, GroupInvite, Images, Text, WithReference,
    Thread, Quote, Edit, Emote, Preferences, PrivatePreferences, Utils
} from './imports'

declare var hive: any;

var supportedTypes = {};
export function addType(type: typeof JSONContent, typeString: string = null) {
    if(typeString === null) typeString = type['TYPE'];
    if(typeString == null) throw "unknown type"; 
    if(supportedTypes[typeString] !== undefined) 
        console.log("warning: redeclaring type: ", typeString);
    supportedTypes[typeString] = type;
}
export function type(content: any): string {
    if(Array.isArray(content) && content.length > 0) return content[0];
    return null;
}  
export function fromJSON(json): JSONContent {        
    var ty = type(json);
    if(ty === null) return null;
    var result = supportedTypes[ty];
    return result == null?null:new result(json);
}
export function text(message: string): Text {
    return new Text([Text.TYPE, message]);        
}
export function images(...images: string[]): Images {
    return new Images([Images.TYPE, ...images]);        
}
export function thread(threadName: string, content: any): Thread {
    if(content instanceof JSONContent) content = content.toJSON();
    return new Thread([Thread.TYPE, threadName, content]);        
}  
export function quote(message: string, parentMessage: SignableMessage,
    quoteFrom: number = 0, quoteTo: number = -1): Quote {
    return new Quote([Quote.TYPE,
        message, 
        parentMessage.getReference(),
        quoteFrom, quoteTo
    ]);        
} 
export function edit(editedContent: JSONContent, parentMessage: SignableMessage): Edit {
    return new Edit([Edit.TYPE, editedContent==null?null:editedContent.toJSON(), 
        parentMessage.getReference()
    ]);        
}
export function emote(emote: string, parentMessage: SignableMessage): Emote {
    return new Emote([Emote.TYPE, emote, 
        parentMessage.getReference()
    ]);        
}
export function groupInvite(message: string, group: string, key: string): Text {
    return new GroupInvite([GroupInvite.TYPE, message, group, key]);        
} 
export function preferences(json: any = {}): Preferences {
    return new Preferences([Preferences.TYPE, json]);        
}
export function encodedMessage(msg: SignableMessage, privateK: any, publicK: string): Encoded {
    if(typeof privateK !== 'string') privateK = privateK.toString();
    var string = JSON.stringify([msg.getUser(), msg.getJSONString(), msg.keytype, msg.getSignature().toString('hex')]);            
    var encoded = [Encoded.TYPE, 'g', hive.memo.encode(privateK, publicK, "#"+string)];    
    return new Encoded(encoded);
}
export function decodedMessage(msg: Encoded, privateK: any): any[] {
    if(typeof privateK !== 'string') privateK = privateK.toString();
    var string = hive.memo.decode(privateK, msg.json[2]);
    if(string.startsWith("#")) string = string.substring(1);
    return JSON.parse(string);
}
export async function encodeTextWithKeychain(user: string, message: string, keychainKeyType: string = 'Posting'): Promise<string> {
    var p = Utils.queueKeychain((keychain, resolve, error)=>{
        keychain.requestEncodeMessage(user, user, '#'+message, keychainKeyType,
            (result)=>{
            if(result.success) resolve(result.result);
            else error(result);
        });
    });
    return await p;
}
export async function decodeTextWithKeychain(user: string, message: string, keychainKeyType: string = 'Posting'): Promise<string> {
   var p = Utils.queueKeychain((keychain, resolve, error)=>{
        keychain.requestVerifyKey(user, message, keychainKeyType,
            (result)=>{
            if(result.success) {
                var string = result.result;
                if(string.startsWith("#")) string = string.substring(1);
                resolve(string);
            }
            else error(result);
        });
    });
    return await p;
}
export {
    JSONContent, Edit, Encoded, GroupInvite, Images, Text, 
    WithReference, Thread, Quote,
    Emote, Preferences, PrivatePreferences
}

