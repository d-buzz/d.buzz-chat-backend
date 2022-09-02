import { Content, Encoded, Emote, JSONContent } from './content/imports'
import { SignableMessage } from './signable-message'

export class DisplayableMessage {
    message: SignableMessage
    reference: DisplayableMessage = null
    edits: DisplayableMessage[] = null
    emotes: DisplayableMessage[] = null
    content: JSONContent
    verified: boolean
    usernames: string[]
    editContent: JSONContent = null
    isEdit: boolean = false

    constructor(message: SignableMessage) {
        this.message = message;
        this.content = undefined;
        this.verified = null;
    }

    init(): void {
        this.usernames = this.message.getGroupUsernames();
    }

    emote(msg: DisplayableMessage) {
        if(this.emotes === null) this.emotes = [msg];
        else {
            this.emotes.push(msg);
            this.emotes.sort((a,b)=>b.getTimestamp()-a.getTimestamp());
        }
    }
    isEmote(): boolean {
        return this.content instanceof Emote;
    }
    edit(msg: DisplayableMessage) {
        if(this.edits === null) this.edits = [msg];
        else {
            this.edits.push(msg);
            this.edits.sort((a,b)=>b.getTimestamp()-a.getTimestamp());
        }
    }
    
    hasUser(user: string) { return this.usernames.indexOf(user) !== -1; }
    
    getUser(): string { return this.message.user; }  
    getConversation(): string { return this.message.conversation; }  
    getTimestamp(): number { return this.message.timestamp; }

    getCommunity(): string { 
        var conversation = this.getConversation();
        if(conversation && conversation.startsWith("hive-")) {
            var i = conversation.indexOf('/');
            return i===-1?conversation:conversation.substring(0,i);
        }
        return null;
    }  

    isEncoded(): boolean {
        return this.content instanceof Encoded;
    }
    getContent(): JSONContent {
        var edits = this.edits;
        if(edits !== null && edits.length > 0) return edits[0].editContent;
        return this.content;
    }
    isVerified(): boolean {
        var edits = this.edits;
        if(edits !== null && edits.length > 0) return edits[0].verified;
        return this.verified;
    }
}
