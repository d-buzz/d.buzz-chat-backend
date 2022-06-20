import { SignableMessage } from './signable-message'

export class Client {
    io: any
    
    constructor(socket: any) {
        this.io = socket;
    }
    read(conversation: string, fromTimestamp: number, toTimestamp: number, callback): void {
        this.io.emit("r", [conversation, fromTimestamp, toTimestamp], callback);
    }
    write(msg: SignableMessage, callback): void {
        this.io.emit(msg.type, msg.toJSON(), callback);
    }
}
