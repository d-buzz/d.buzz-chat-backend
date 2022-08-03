import { 
    SignableMessage, JSONContent, Encoded, Text, WithReference,
    Thread, Quote, Emote, Preferences, PrivatePreferences
} from './imports'

declare var hive: any;
declare var hive_keychain: any;

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
    case Emote.TYPE: return new Emote(json);
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
export function emote(emote: string, parentMessage: SignableMessage): Emote {
    return new Emote([Emote.TYPE, emote, 
        parentMessage.getReference()
    ]);        
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
export async function decodeTextWithKeychain(user: string, message: string, keychainKeyType: string = 'Posting'): Promise<string> {
    var p = new Promise<string>((resolve, error)=>{
        hive_keychain.requestVerifyKey(user, message, keychainKeyType,
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
    JSONContent, Encoded, Text,
    WithReference, Thread, Quote,
    Emote, Preferences, PrivatePreferences
}

