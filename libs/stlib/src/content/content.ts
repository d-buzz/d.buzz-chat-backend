import { 
    SignableMessage, JSONContent, Encoded, GroupInvite, Images, Text, WithReference,
    Thread, OnlineStatus, Quote, Edit, Emote, Flag, Mention, Preferences, PrivatePreferences, Utils
} from './imports'

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
export function mention(parentMessage: SignableMessage): Mention {
    return new Mention([Mention.TYPE,
        parentMessage.getUser(),
        parentMessage.getConversation(), 
        parentMessage.getTimestamp(),
        parentMessage.getSignatureBase64()
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
export function flag(reason: string, parentMessage: SignableMessage): Emote {
    return new Flag([Flag.TYPE, reason, 
        parentMessage.getReference()
    ]);        
}
export function groupInvite(message: string, group: string, key: string): Text {
    return new GroupInvite([GroupInvite.TYPE, message, group, key]);        
} 
export function preferences(json: any = {}): Preferences {
    return new Preferences([Preferences.TYPE, json]);        
}
export function onlineStatus(online: any, communities: string[]): OnlineStatus {
    return new OnlineStatus([OnlineStatus.TYPE, online, communities]);        
}
export function encodeTextWithKey(text: string, privateK: any, publicK: any): string {
    return Utils.encodeTextWithKey(text, privateK, publicK);
}
export function decodeTextWithKey(text: string, privateK: any): string {
    return Utils.decodeTextWithKey(text, privateK);
}
export function encodedMessage(msg: SignableMessage, privateK: any, publicK: any): Encoded {
    var string = JSON.stringify([msg.getUserMentionsString(), msg.getJSONString(), msg.keytype, msg.getSignature().toString('hex')]);            
    var encoded = [Encoded.TYPE, 'g', Utils.encodeTextWithKey(string, privateK, publicK)];    
    return new Encoded(encoded);
}
export function decodedMessage(msg: Encoded, privateK: any): any[] {
    return JSON.parse(Utils.decodeTextWithKey(msg.json[2], privateK));
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
    JSONContent, Edit, Encoded, Flag, GroupInvite, Images, Mention, Text, 
    WithReference, Thread, Quote, OnlineStatus,
    Emote, Preferences, PrivatePreferences
}

