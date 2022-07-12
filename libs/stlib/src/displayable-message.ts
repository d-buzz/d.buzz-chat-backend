import { Content, JSONContent } from './content/imports'
import { SignableMessage } from './signable-message'

export class DisplayableMessage {
    message: SignableMessage
    content: JSONContent
    verified: boolean

    getUser(): string { return this.message.user; }  
    getConversation(): string { return this.message.conversation; }  
    getTimestamp(): number { return this.message.timestamp; }

    getContent(): JSONContent { return this.content; }
    isVerified(): boolean { return this.verified; }

}
