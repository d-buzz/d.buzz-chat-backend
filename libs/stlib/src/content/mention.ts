import { JSONContent, SignableMessage } from './imports'

export class Mention extends JSONContent {
    static readonly TYPE:string = "m";
    constructor(json: any[]) { super(json); }
    getUser(): string { return this.json[1]; }    
    setUser(user: string) { this.json[1] = user; } 
    getConversation(): string { return this.json[2]; }    
    setConversation(conversation: string) { this.json[2] = conversation; } 
    getTimestamp(): string { return this.json[3]; }    
    setTimestamp(timestamp: string) { this.json[3] = timestamp; } 
    getSignature(): string { return this.json[4]; }    
    setSignature(signature: string) { this.json[4] = signature; } 

    forUser(user: string, conversation: string | string[]): SignableMessage {
        if(Array.isArray(conversation)) conversation = '&'+conversation.join('&');
        return SignableMessage.create(user, conversation, this.json);
    }
}
