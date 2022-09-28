import { Content, Encoded, Emote, JSONContent, Thread } from './content/imports'
import { SignableMessage } from './signable-message'

export class DisplayableMessage {
    message: SignableMessage
    reference: DisplayableMessage = null
    edits: DisplayableMessage[] = null
    emotes: DisplayableEmote[] = null
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
    getEmoteIndex(emote: string): number {
        if(this.emotes === null) return -1;
        for(var i = 0; i < this.emotes.length; i++)
            if(this.emotes[i].emote === emote)
                return i;
        return -1;
    }
    emote(msg: DisplayableMessage) {
        var content = msg.content;
        if(!(content instanceof Emote)) return;
        if(this.emotes === null) this.emotes = [];
        var timestamp = msg.getTimestamp();
        var emote = content.getText();
        var emoteIndex = this.getEmoteIndex(emote);
        var obj;
        if(emoteIndex === -1) { 
            obj = new DisplayableEmote(emote,timestamp);
            this.emotes.push(obj);            
        }
        else obj = this.emotes[emoteIndex];
        obj.add(msg);
        this.emotes.sort((a,b)=>b.timestamp-a.timestamp);
    }
    isThread(): boolean {
        return this.getEditedContent() instanceof Thread;
    }
    getThreadName(): string {
        var content = this.getEditedContent();
        return (content instanceof Thread)?content.getName():null;
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
    getEditedContent(): JSONContent {
        var edits = this.edits;
        if(edits !== null && edits.length > 0) return edits[0].editContent;
        return this.content;
    }
    getContent(): JSONContent {
        var content = this.getEditedContent();
        if(content instanceof Thread) return content.getContent();
        return content;
    }
    isVerified(): boolean {
        var edits = this.edits;
        if(edits !== null && edits.length > 0) return edits[0].verified;
        return this.verified;
    }
}
export class DisplayableEmote {
    emote: string
    users: string[] = []
    messages: DisplayableMessage[] = []
    timestamp: number
    constructor(emote: string, timestamp: number) {
        this.emote = emote;
        this.timestamp = timestamp;
    }
    add(msg: DisplayableMessage) {
        var user = msg.getUser();
        if(this.users.indexOf(user) === -1)
            this.users.push(user);
        this.messages.push(msg);
        this.timestamp = Math.min(this.timestamp, msg.getTimestamp());   
    }
}



