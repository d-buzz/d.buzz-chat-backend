import { 
    SignableMessage, JSONContent, Encoded, Text, WithReference,
    Thread, Quote, Emote, Preferences
} from './imports'

declare var hive: any;
declare var hive_keychain: any;

export function fromJSON(json): JSONContent {        
    var type = type(json);
    if(type === null) return null;
    switch(type) {
    case Text.TYPE: return new Text(json);
    case Thread.TYPE: return new Thread(json);
    case Quote.TYPE: return new Quote(json);
    case Emote.TYPE: return new Emote(json);
    case Preferences.TYPE: return new Preferences(json);
    case Encoded.TYPE: return new Encoded(json);
    }
    return null;
}

export function type(content: any): string {
    if(Array.isArray(content) && content.length > 0) return content[0];
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

export {
    JSONContent, Encoded, Text,
    WithReference, Thread, Quote,
    Emote, Preferences
}

