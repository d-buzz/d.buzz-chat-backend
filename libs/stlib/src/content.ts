import { SignableMessage } from './signable-message'

export namespace Content {
    const TYPE_TEXT:string = "t";
    const TYPE_THREAD:string = "h";
    const TYPE_QUOTE:string = "q";
    const TYPE_EMOTE:string = "e";
    
    export function fromJSON(json): JSONContent {        
        var type = type(json);
        if(type === null) return null;
        switch(type) {
        case TYPE_TEXT: return new Text(json);
        case TYPE_THREAD: return new Thread(json);
        case TYPE_QUOTE: return new Quote(json);
        case TYPE_EMOTE: return new Emote(json);
        }
        return null;
    }
    export class JSONContent {
        json: any[]
        constructor(json: any[]) {
            this.json = json;
        }
        getType(): string { return this.json[0]; }
        toJSON(): any { return this.json; }
        forUser(user: string, conversation: string | string[]): SignableMessage {
            return SignableMessage.create(user, conversation, this.json);
        }
    }
    export class Text extends JSONContent {
        constructor(json: any[]) { super(json); }
        getText(): string { return this.json[1]; }    
        setText(text: string) { this.json[1] = text; } 
    }
    export class WithReference extends JSONContent {
        constructor(json: any[]) { super(json); }
        getText(): string { return this.json[1]; }    
        setText(text: string) { this.json[1] = text; }   
        getReference(): string { return this.json[2]; }    
        setReference(ref: string) { this.json[2] = ref; }   
    }
    export class Thread extends WithReference {
        constructor(json: any[]) { super(json); }
    }
    export class Quote extends WithReference {
        constructor(json: any[]) { super(json); }
        getFrom(): string { return this.json[3]; }    
        getTo(): string { return this.json[4]; }    
        setFromTo(from: number, to: number) { 
            this.json[3] = from;
            this.json[4] = to;
        }    
    }
    export class Emote extends WithReference {
        constructor(json: any[]) { super(json); }
    }
    export function type(content: any): string {
        if(Array.isArray(content) && content.length > 0) return content[0];
        return null;
    }    

    export function text(message: string): Text {
        return new Text([TYPE_TEXT, message]);        
    } 
    export function thread(message: string, threadName: string): Thread {
        return new Thread([TYPE_THREAD,
            message, threadName]);        
    }  
    export function quote(message: string, parentMessage: SignableMessage,
        quoteFrom: number = 0, quoteTo: number = -1): Quote {
        return new Quote([TYPE_QUOTE,
            message, 
            parentMessage.getReference(),
            quoteFrom, quoteTo
        ]);        
    } 
    export function emote(emote: string, parentMessage: SignableMessage): Emote {
        return new Emote([TYPE_EMOTE, emote, 
            parentMessage.getReference()
        ]);        
    }
}

