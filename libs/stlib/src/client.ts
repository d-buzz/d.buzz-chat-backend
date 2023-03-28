import { SignableMessage } from './signable-message'

export class CallbackResult {
    success: boolean
    result: any
    extra: any = null
    message: any
    constructor(success: boolean, result: any) {
        this.success = success;
        this.result = result;
    }
    isSuccess(): boolean { return this.success; }
    getResult() { return this.isSuccess()?this.result:null; }
    getPaginationId(): number { return (this.extra != null && typeof this.extra === 'number')?this.extra:-1; }
    getError() { return this.isSuccess()?null:this.result; }
}
export class Client {
    io: any
    onmessage: any
    onupdate: any
    constructor(socket: any) {
        this.io = socket;
        socket.on("w", (text)=>{
            if(this.onmessage !== null) this.onmessage(JSON.parse(text));
        });
        socket.on("u", (data)=>{
            if(this.onupdate !== null) this.onupdate(data);
        });
    }
    async readStats(conversations: string[] = null): Promise<CallbackResult> {
        return await this.emit('s', conversations);
    }
    async readInfo(): Promise<CallbackResult> {
        return await this.emit('i', "");
    }
    async readNodeVersion(): Promise<CallbackResult> {
        return await this.emit('v', "");
    }
    async readPreferences(username: string): Promise<CallbackResult> {
        return await this.emit("r", ["r", '@', username]);
    }
    async readUserConversations(username: string): Promise<CallbackResult> {
        return await this.emit("r", ["r", '@@', username]);
    }
    async readCommunity(username: string): Promise<CallbackResult> {
        return await this.emit("rg", username);
    }
    async read(conversation: string, fromTimestamp: number = -1, toTimestamp: number = -1, lastId: number = -1, limit: number = 100): Promise<CallbackResult> {
        return await this.emit("r", ["r", conversation, fromTimestamp, toTimestamp, lastId, limit]);
    }
    async readUserMessages(username: string, fromTimestamp: number = -1, toTimestamp: number = -1, lastId: number = -1, limit: number = 100): Promise<CallbackResult> {
        return await this.read('@'+username, fromTimestamp, toTimestamp, lastId, limit);
    }
    async readMentions(username: string, fromTimestamp: number = -1, toTimestamp: number = -1, lastId: number = -1, limit: number = 100): Promise<CallbackResult> {
        return await this.read('&'+username, fromTimestamp, toTimestamp, lastId, limit);
    }
    async readOnlineStatus(usernames: string | string[], maxTimestamp: number = 0): Promise<CallbackResult> {
        if(!Array.isArray(usernames)) usernames = [usernames];
        return await this.emit("r", ["r", '$online', usernames, maxTimestamp]);
    }
    async readOnlineStatusForCommunity(username: string, maxTimestamp: number = 0): Promise<CallbackResult> {
        return await this.emit("r", ["r", '$online', username, maxTimestamp]);
    }
    async createGuestAccount(username: string, publicPostingKey: string): Promise<CallbackResult> {
        return await this.emit("a", ["a", username, username, publicPostingKey]);
    }
    async write(msg: SignableMessage): Promise<CallbackResult> {
        if(!msg.isSigned()) throw 'message is not signed.';
        if(msg.isEncrypted() && !msg.isSignedWithGroupKey()) throw 'message is not signed with group key.';
        return await this.write0(msg);
    }
    async write0(msg: SignableMessage): Promise<CallbackResult> {
        var result = await this.emit('w', msg.toJSON());
        result.message = msg;
        return result;
    }
    async join(conversation: string): Promise<CallbackResult> {
        return await this.emit('j', conversation);
    }
    async leave(conversation: string): Promise<CallbackResult> {
        return await this.emit('l', conversation);
    }
    async emit(type: string, data: any): Promise<CallbackResult> {
        return new Promise<CallbackResult>((resolve,error)=>{
            try {
                this.io.emit(type, data, (data)=>{
                    var result = new CallbackResult(data[0], data[1]);
                    if(data.length > 2) result.extra = data[2];
                    resolve(result);
                });
            } catch(e) { error(e); }
        });
    }
    close() {
        this.io.close();    
    }
}
