import { SignableMessage } from './signable-message'

export class CallbackResult {
    success: boolean
    result: any
    constructor(success: boolean, result: any) {
        this.success = success;
        this.result = result;
    }
    isSuccess() { return this.success; }
    getResult() { return this.isSuccess()?this.result:null; }
    getError() { return this.isSuccess()?null:this.result; }
}
export class Client {
    io: any
    onmessage: any
    
    constructor(socket: any) {
        this.io = socket;
        socket.on("w", (text)=>{
            if(this.onmessage !== null) this.onmessage(JSON.parse(text));
        });
    }
    readNodeVersion(callback: (CallbackResult) => void) {
        this.emit('v', "", callback);
    }
    readPreferences(username: string, callback: (CallbackResult) => void): void {
        this.emit("r", ["r", '@', username], callback);
    }
    readUserMessages(username: string, fromTimestamp: number, toTimestamp: number, callback: (CallbackResult) => void): void {
        this.read('@'+username, fromTimestamp, toTimestamp, callback);
    }
    read(conversation: string, fromTimestamp: number, toTimestamp: number, callback: (CallbackResult) => void): void {
        this.emit("r", ["r", conversation, fromTimestamp, toTimestamp], callback);
    }
    write(msg: SignableMessage, callback: (CallbackResult) => void): void {
        if(!msg.isSigned()) throw 'message is not signed.';
        if(msg.isEncrypted() && !msg.isSignedWithGroupKey()) throw 'message is not signed with group key.';
        this.write0(msg, callback);
    }
    write0(msg: SignableMessage, callback: (CallbackResult) => void): void {
        this.emit(msg.type, msg.toJSON(), callback);
    }
    join(conversation: string, callback: (CallbackResult) => void): void {
        this.emit('j', conversation, callback);
    }
    leave(conversation: string, callback: (CallbackResult) => void): void {
        this.emit('l', conversation, callback);
    }
    emit(type: string, data: any, callback: (CallbackResult) => void): void {
        this.io.emit(type, data, (data)=>{
            if(callback != null)
                callback(new CallbackResult(data[0], data[1]));
        });
    }
}
