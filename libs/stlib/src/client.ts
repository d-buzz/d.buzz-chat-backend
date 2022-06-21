import { SignableMessage } from './signable-message'

export class Client {
    io: any
    onmessage: any
    
    constructor(socket: any) {
        this.io = socket;
        socket.on("message", (text)=>{
            const data = JSON.parse(text);
            console.log("receiving");
            console.log(data);

            if(this.onmessage !== null) this.onmessage(data);
        });
    }
    read(conversation: string, fromTimestamp: number, toTimestamp: number, callback): void {
        this.io.emit("r", ["r", conversation, fromTimestamp, toTimestamp], callback);
    }
    write(msg: SignableMessage, callback): void {
        this.io.emit(msg.type, msg.toJSON(), callback);
    }
}
