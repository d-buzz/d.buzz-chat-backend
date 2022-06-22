import { SignableMessage } from './signable-message'

export class Client {
    io: any
    onmessage: any
    
    constructor(socket: any) {
        this.io = socket;
        socket.on("w", (text)=>{
            if(this.onmessage !== null) this.onmessage(JSON.parse(text));
        });
    }
    read(conversation: string, fromTimestamp: number, toTimestamp: number, callback): void {
        this.io.emit("r", ["r", conversation, fromTimestamp, toTimestamp], callback);
    }
    write(msg: SignableMessage, callback): void {
        this.io.emit(msg.type, msg.toJSON(), callback);
    }
    join(conversation: string) {
        this.io.emit('j', conversation);
    }
    leave(conversation: string) {
        this.io.emit('l', conversation);
    }
}
