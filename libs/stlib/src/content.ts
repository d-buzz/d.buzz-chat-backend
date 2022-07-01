import { SignableMessage } from './signable-message'
declare var hive_keychain: any;

export namespace Content {
    const TYPE_TEXT:string = "t";
    const TYPE_THREAD:string = "h";
    const TYPE_QUOTE:string = "q";
    const TYPE_EMOTE:string = "e";
    const TYPE_PREFERENCES:string = "p";
    const TYPE_ENCODED:string = "x";
    
    export function fromJSON(json): JSONContent {        
        var type = Content.type(json);
        if(type === null) return null;
        switch(type) {
        case TYPE_TEXT: return new Text(json);
        case TYPE_THREAD: return new Thread(json);
        case TYPE_QUOTE: return new Quote(json);
        case TYPE_EMOTE: return new Emote(json);
        case TYPE_PREFERENCES: return new Preferences(json);
        case TYPE_ENCODED: return new Encoded(json);
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
        async encodeWithKeychain(user: string, groupUsers: string[], 
                keychainKeyType: string): Promise<Encoded> {
            if(this instanceof Encoded) return this;
            var string = JSON.stringify(this.json);

            groupUsers.sort();
            var encoded = [TYPE_ENCODED, keychainKeyType.toLowerCase().charAt(0)];
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
    export class Encoded extends JSONContent {
        constructor(json: any[]) { super(json); }
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
    export class Preferences extends JSONContent {
        constructor(json: any[]) { super(json); }
        getPreferencesJSON(): any { return this.json[1]; }
        setPreferencesJSON(json: any): void { this.json[1] = json; }
        forUser(user: string, conversation: string | string[]='@'): SignableMessage {
            if(conversation !== '@') throw "conversation is not '@'";
            return SignableMessage.create(user, conversation, this.json);
        }
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
    export function preferences(json: any = {}): Preferences {
        return new Preferences([TYPE_PREFERENCES, json]);        
    }
}

