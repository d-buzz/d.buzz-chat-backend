import { SignableMessage } from './signable-message'

/**
 * CallbackResult represents result of request from backend node. 
 *
 * Example of usage:
 *
 * var result: CallbackResult = await client.readInfo();
 * if(result.isSuccess()) {
 *     var data = result.getResult();
 * }
 * else {
 *     console.log(result.getError());
 * }
 */
export class CallbackResult {
    /**
     * True if the result suceeded.
     */
    success: boolean
    /**
     * Data of the result if result suceeded, otherwise error message.
     */
    result: any
    /**
     * Can hold extra data such as pagination id.
     */
    extra: any = null
    /**
     * If this request broadcasted a SignableMessage, the object that was sent
     * is stored here.
     */
    message: any
    /**
     * Creates a new CallbackResult.
     *
     * @param success
     * @param result data or error message is call did not succeed
     */
    constructor(success: boolean, result: any) {
        this.success = success;
        this.result = result;
    }
    /**
     * Returns true if the request suceeded.
     */
    isSuccess(): boolean { return this.success; }
    /**
     * Returns the data of the result if the requests suceeded, otherwise null.
     */
    getResult() { return this.isSuccess()?this.result:null; }
    /**
     * Returns pagination id or -1 if there is none.
     */
    getPaginationId(): number { return (this.extra != null && typeof this.extra === 'number')?this.extra:-1; }
    /**
     * Returns error message or null if there is none.
     */
    getError() { return this.isSuccess()?null:this.result; }
}
/**
 * Client class represents a client which communicates with backend node.
 */
export class Client {
    /**
     * SocketIO object.
     */
    io: any
    /**
     * Callback listener for on message events. Messages arrive in json format.
     *
     * Example:
     * client.onmessage = (messageJSON)=>{ console.log(messageJSON); };
     */
    onmessage: any = null
    /**
     * Callback listener for on update events such as community data update.
     *
     * Example:
     * client.onmessage = (messageJSON)=>{ console.log(messageJSON); };
     */
    onupdate: any = null
    /**
     * Creates a new client instance with provided socket.
     *
     * Example:
     * var socket = io("https://chat-api.peakd.com", {
     *  transports:["websocket", "polling"]
     * });
     * var client = new stlib.Client(socket);
     *
     * @param socket socketio socket
     */
    constructor(socket: any) {
        this.io = socket;
        socket.on("w", (text)=>{
            if(this.onmessage !== null) this.onmessage(JSON.parse(text));
        });
        socket.on("u", (data)=>{
            if(this.onupdate !== null) this.onupdate(data);
        });
    }
    /**
     * Reads usage stats from backend node.
     *
     * Returns an array of objects representing days, with each containing the
     * a map of communities and the number of messages posted in it on that day.
     * 
     * Up to 7 days of data is returned. 
     *
     * @param conversations array of conversation strings
     */
    async readStats(conversations: string[] = null): Promise<CallbackResult> {
        return await this.emit('s', conversations);
    }
    /**
     * Reads information from backend node.
     *
     * Returns a JSON object with the following properties:
     * name: network name
     * host: domain of the node
     * account: hive account associated with the node or empty
     * version: backend version
     * nodes: array of domains of other backend nodes
     * preferencesChecksum: checksum of user preferences
     * messagesChecksum: checksums of messages group by timestamp
     * time: timestamp
     */
    async readInfo(): Promise<CallbackResult> {
        return await this.emit('i', "");
    }
    /**
     * Returns backend version.
     */
    async readNodeVersion(): Promise<CallbackResult> {
        return await this.emit('v', "");
    }
    /**
     * Returns user preferences.
     *
     * The backend supports uploading user preferences for both hive accounts and guest accounts.
     * For details on preferences {@see Preferences}
     *
     * @param username
     */
    async readPreferences(username: string): Promise<CallbackResult> {
        return await this.emit("r", ["r", '@', username]);
    }
    /**
     * Returns an array of recent direct conversations.
     *
     * @param username
     */
    async readUserConversations(username: string): Promise<CallbackResult> {
        return await this.emit("r", ["r", '@@', username]);
    }
    /**
     * Returns community data.
     *
     * @param username
     */
    async readCommunity(username: string): Promise<CallbackResult> {
        return await this.emit("rg", username);
    }
    /**
     * Returns upvotes data.
     *
     * @param conversations array of conversation strings
     */
    async readUpvotes(conversations: string[] = null): Promise<CallbackResult> {
        return await this.emit("ru", conversations);
    }
    /**
     * Reads up to 100 messages in conversations with optional timestamps, pagination number and limit.
     * 
     * Example to paginate the results:
     * var result = await client.read(conversation);
     * if(result.isSuccess()) {
     *    var messages = result.getResult();
     *    if(messages.length > 0) {
     *       var oldestMessageTimestamp = messages[messages.length-1][4];
     *       //Read next 100 messages:
     *       var result200 = await client.read(conversation, -1,
     *               oldestMessageTimestamp, result.getPaginationId());
     *    }
     * }
     *
     * @param conversation conversation to read messages from
     * @param fromTimestamp timestamp in milliseconds or -1
     * @param toTimestamp max timestamp in milliseconds or -1
     * @param lastId paginationId or -1
     * @param limit read at most this number of messages, default: 100, max: 100
     */
    async read(conversation: string, fromTimestamp: number = -1, toTimestamp: number = -1, lastId: number = -1, limit: number = 100): Promise<CallbackResult> {
        return await this.emit("r", ["r", conversation, fromTimestamp, toTimestamp, lastId, limit]);
    }
    /**
     * Reads up to 100 user messages with optional timestamps, pagination number and limit.
     *
     * @param username username to read user messages from
     * @param fromTimestamp timestamp in milliseconds or -1
     * @param toTimestamp max timestamp in milliseconds or -1
     * @param lastId paginationId or -1
     * @param limit read at most this number of messages, default: 100, max: 100
     *
     */
    async readUserMessages(username: string, fromTimestamp: number = -1, toTimestamp: number = -1, lastId: number = -1, limit: number = 100): Promise<CallbackResult> {
        return await this.read('@'+username, fromTimestamp, toTimestamp, lastId, limit);
    }
    /**
     * Reads up to 100 mentions with optional timestamps, pagination number and limit.
     * 
     * @param username username to read mentions from
     * @param fromTimestamp timestamp in milliseconds or -1
     * @param toTimestamp max timestamp in milliseconds or -1
     * @param lastId paginationId or -1
     * @param limit read at most this number of messages, default: 100, max: 100
     *
     */
    async readMentions(username: string, fromTimestamp: number = -1, toTimestamp: number = -1, lastId: number = -1, limit: number = 100): Promise<CallbackResult> {
        return await this.read('&'+username, fromTimestamp, toTimestamp, lastId, limit);
    }
    /**
     * Reads online status for one user or array of users.
     *
     * @param usernames username or array of usernames
     * @param maxTimestamp timestamp to trim older results than specified timestamp
     */
    async readOnlineStatus(usernames: string | string[], maxTimestamp: number = 0): Promise<CallbackResult> {
        if(!Array.isArray(usernames)) usernames = [usernames];
        return await this.emit("r", ["r", '$online', usernames, maxTimestamp]);
    }
    /**
     * Reads online status for community.
     *
     * @param username username of community
     * @param maxTimestamp timestamp to trim older results than specified timestamp
     */
    async readOnlineStatusForCommunity(username: string, maxTimestamp: number = 0): Promise<CallbackResult> {
        return await this.emit("r", ["r", '$online', username, maxTimestamp]);
    }
    /**
     * Creates guest account request.
     *
     * @param username username of guest account
     * @param publicPostingKey new publc posting key of guest account
     */
    async createGuestAccount(username: string, publicPostingKey: string): Promise<CallbackResult> {
        return await this.emit("a", ["a", username, username, publicPostingKey]);
    }
    /**
     * Broadcasts a SignableMessage. Throws error if message is not signed or not in valid format.
     */
    async write(msg: SignableMessage): Promise<CallbackResult> {
        if(!msg.isSigned()) throw 'message is not signed.';
        if(msg.isEncrypted() && !msg.isSignedWithGroupKey()) throw 'message is not signed with group key.';
        return await this.write0(msg);
    }
    /**
     * Broadcasts a SignableMessage without additional validation.
     */
    async write0(msg: SignableMessage): Promise<CallbackResult> {
        var result = await this.emit('w', msg.toJSON());
        result.message = msg;
        return result;
    }
    /**
     * Enable receiving events for specified conversation. The events call {@see onmessage} callback.
     *
     * @param conversation following formats of conversation can be used to receive messages:
     * "hive-XXXXXXX/0": would receive messages posted in particular community in stream numbered 0
     * "hive-XXXXXXX/*": would receive messages for all streams in specified community
     * "userA": would receive messages for "userA"
     * "&userA": would recieve mentions for "userA"
     * "$online": would recieve online status changes
     * "#userA/0": would receive messages from joinable group created by userA with numbered 0
     */
    async join(conversation: string): Promise<CallbackResult> {
        return await this.emit('j', conversation);
    }
    /**
     * Disable receiving events for specified conversation.
     * 
     * @param conversation conversation to not receive events from
     */
    async leave(conversation: string): Promise<CallbackResult> {
        return await this.emit('l', conversation);
    }
    /**
     * Sends data to backend.
     */
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
    /**
     * Closes the connection.
     */
    close() {
        this.io.close();    
    }
}
