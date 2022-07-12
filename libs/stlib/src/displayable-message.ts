import { Content, JSONContent } from './content/imports'
import { SignableMessage } from './signable-message'

export class DisplayableMessage {
    message: SignableMessage
    content: JSONContent
    verified: boolean
    usernames: string[]

    constructor(message: SignableMessage) {
        this.message = message;
        this.content = undefined;
        this.verified = null;
    }

    init(): void {
        this.usernames = this.message.getGroupUsernames();
    }
    
    hasUser(user: string) { return this.usernames.indexOf(user) !== -1; }
    
    getUser(): string { return this.message.user; }  
    getConversation(): string { return this.message.conversation; }  
    getTimestamp(): number { return this.message.timestamp; }

    getContent(): JSONContent { 
        return this.content;
    }
    isVerified(): boolean { 
        return this.verified;
    }

}
