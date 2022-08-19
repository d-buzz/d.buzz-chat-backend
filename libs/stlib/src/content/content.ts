import { 
    SignableMessage, JSONContent, Encoded, GroupInvite, Text, WithReference,
    Thread, Quote, Edit, Emote, Preferences, PrivatePreferences, Utils
} from './imports'

declare var hive: any;

export function type(content: any): string {
    if(Array.isArray(content) && content.length > 0) return content[0];
    return null;
}  
export function fromJSON(json): JSONContent {        
    var ty = type(json);
    if(ty === null) return null;
    switch(ty) {
    case Text.TYPE: return new Text(json);
    case Thread.TYPE: return new Thread(json);
    case Quote.TYPE: return new Quote(json);
    case Edit.TYPE: return new Edit(json);
    case Emote.TYPE: return new Emote(json);
    case GroupInvite.TYPE: return new GroupInvite(json);
    case Preferences.TYPE: return new Preferences(json);
    case Encoded.TYPE: return new Encoded(json);
    }
    return null;
}
export function text(message: string): Text {
    return new Text([Text.TYPE, message]);        
} 
export function thread(message: string, threadName: string): Thread {
    return new Thread([Thread.TYPE,
        message, threadName]);        
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
    JSONContent, Edit, Encoded, GroupInvite, Text, 
    WithReference, Thread, Quote,
    Emote, Preferences, PrivatePreferences
}

