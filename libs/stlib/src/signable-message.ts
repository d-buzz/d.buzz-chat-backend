import { Content, Preferences, JSONContent, Encoded } from './content/imports'
import { Community } from './community'
import { Utils } from './utils'

/**
 * SignableMessage represents a JSON message that can be signed 
 * and verified.
 *
 * Each message is composed of seven elements, namely:
 * type, user/s, conversation, json content, timestamp, keytype and signature
 *  
 * An example of a signable message in json format is:
 * ["w", "usernameA", "hive-1111111/0", "[\"t\",\"hi\"]", 1692047295280, "p", "2019783ab..."]
 * 
 */
export class SignableMessage {
    static TYPE_ACCOUNT = 'a';
    static TYPE_MESSAGE = 'm';
    static TYPE_WRITE_MESSAGE = 'w';
    type: string
    user: string
    mentions: string[]
    conversation: string
    json: string
    timestamp: number
    keytype: string
    signature: any

    /**
     * Creates a new message with type TYPE_WRITE_MESSAGE   
     */
    constructor() {
        this.type = "w";
    }
    /**
     * Creates a new message with provided user, conversation, content and optional type
     * 
     * @param user the user who can sign the message
     * @param conversation conversation string eg.: "hive-1111111/0" 
     *         or array of strings of up to four users for direct message
     * @param json json content
     * @param type optional message type, default TYPE_WRITE_MESSAGE
     */
    static create(user: string,conversation: string | string[], json: any, type: string = 'w'): SignableMessage {
        var s = new SignableMessage();
        s.setMessageType(type);
        s.setUser(user);
        s.setConversation(conversation);
        s.setJSON(json);
        return s;
    }
    /**
     * Set the message type.
     *
     * @param type message type, currently supported types:
     *     TYPE_WRITE_MESSAGE - default, message is passed to backend peers and stored 
     *     TYPE_MESSAGE - message is passed to backend peers but not stored
     *     TYPE_ACCOUNT - used for guest account creation
     */
    setMessageType(type: string) { this.type = type; }
    /**
     * Sets the user who can sign this message.
     * Additionaly, an `&` and another user can be added
     * to be mentioned with this message. More than one
     * mention can be added.
     * 
     * @param user username who can sign the message and optional 
     *        `&` separated list of usernames to mention  
     */
    setUser(user: string) { 
        var i = user.indexOf('&');
        if(i !== -1) {
            this.user = user.substring(0, i);
            this.mentions = user.substring(i+1).split('&');
        }
        else { 
            this.user = user;            
            this.mentions = null;
        }
    }
    /**
     * Set user and list of users to mention.
     *
     * @param user user who can sign the message
     * @param mentions array of usernames to mention or null
     */
    setUserMentions(user: string, mentions: string[] = null) { this.user = user; this.mentions = mentions; }
    /**
     * Set conversation where to send the message to.
     *
     * Community conversations have the form of `hive-XXXXXXX/N`
     * where `hive-XXXXXXX` is the username of community and `N` is number of channel.
     *
     * Direct messages have the form of `user1|user2` or `user1|user2|user3` or
     * `user1|user2|user3|user4`; the usernames are presented in alphabetical order
     * and separated by `|`
     *
     * Group messages have the form of `#userA/N` where `N` is the number of group
     * created by `userA` 
     *
     * @param conversation conversation string or unsorted array of usernames for direct message
     */
    setConversation(conversation: string | string[]) {
        if(Array.isArray(conversation)) this.setConversationGroup(conversation); 
        else this.conversation = conversation;
    }
    /**
     * Set conversation to a direct message between provided users.
     *
     * @param usernames unsorted array of usernames with length of at least 2
     *          and at most 4 users
     */
    setConversationGroup(usernames: string[]) { 
        if(!(usernames.length > 1 && usernames.length <= 4))
            throw "Group Conversation requires [2-4] users."
        usernames.sort();
        this.conversation = usernames.join('|');
    }
    /**
     * Set json content of this message.
     *
     * If object is provided and has method `toJSON`, it is called.
     *
     * @param js json content in either stringified format, object or object
     *           with `toJSON` method
     */
    setJSON(js: any) { 
        js = (js.toJSON !== undefined)?js.toJSON():js;
        this.json = (typeof js === 'string')?js:JSON.stringify(js);
    }
    /**
     * Returns the message type.
     *
     * Currently supported types:
     *  TYPE_WRITE_MESSAGE - default, message is passed to backend peers and stored 
     *  TYPE_MESSAGE - message is passed to backend peers but not stored
     *  TYPE_ACCOUNT - used for guest account creation
     */
    getMessageType(): string { return this.type; }
    /**
     * Returns the user this message is signed or to be signed with.
     */
    getUser(): string { return this.user; }
    /**
     * Returns an array of users to mention or null.
     */
    getMentions(): string[] { return this.mentions; }
    /**
     * Returns a string of users to mention beginning and separated with '&' or null.
     */
    getMentionsString(): string { 
        var mentions = this.mentions;
        return mentions==null?"":('&'+this.mentions.join('&'));
    }
    /**
     * Returns user {@see getUser} with mentions {@see getMentionsString} .
     */
    getUserMentionsString(): string {
        var mentions = this.mentions;
        return this.hasMentions()?(this.user+this.getMentionsString()):this.user;
    }
    /**
     * Returns the conversation this message belongs to.
     *
     * {@see setConversation} for details on conversation format.
     */
    getConversation(): string { return this.conversation; }
    /**
     * Returns the username of conversation: eg.: conversation "hive-1111111/0" => "hive-1111111" .
     *
     * Specifically, returns substring of up to character '/'.
     */
    getConversationUsername(): string { 
        var i = this.conversation.indexOf('/');
        return (i === -1)?this.conversation:this.conversation.substring(0, i);
    }
    /**
     * Returns the content of this message in stringified JSON format.
     *
     * The predefined content has the form of `["type", ...]`, for example
     * `["t", "hi"]` defines a text message
     * Arbitrary content type is allowed, for list of predefined types see {@see Content}
     */
    getJSONString(): string { return this.json; }
    /**
     * Parse content string of this message into {@see JSONContent} .
     */
    getContent(): JSONContent { return Content.fromJSON(JSON.parse(this.json)); }
    /**
     * Returns the timestamp in milliseconds.
     */
    getTimestamp(): number { return this.timestamp;}
    /**
     * Returns an array of usernames if this conversation is a group conversation in format `user1|user2...` .
     *
     * Otherwise returns an array with this conversation.
     */
    getGroupUsernames(): string[] { return Utils.getGroupUsernames(this.conversation); }
    /**
     * Returns true is this conversation is a community conversation in form of `hive-XXXXXXX/N` .
     */    
    isCommunityConversation(): boolean { return Utils.isCommunityConversation(this.conversation);}
    /**
     * Returns true if this conversation is a group conversation in form of `user1|user2...` ,    
     */    
    isGroupConversation(): boolean { return Utils.isGroupConversation(this.conversation); }
    /**
     * Returns true if this conversation is a joinable group conversation in form of `#user/N` .    
     */    
    isJoinableGroupConversation(): boolean { return Utils.isJoinableGroupConversation(this.conversation); }
    /**
     * Returns true if this message has mentions.
     */    
    hasMentions(): boolean { return this.mentions != null && this.mentions.length > 0; }    
    /**
     * Returns ture if this conversation begins with `#` .
     */    
    isEncrypted() { return this.conversation.startsWith("#"); }
    /**
     * Returns true if this conversation is equal to `@` .
     *
     * Messages sent to this location are expected to have content type {@link Preferences}
     * and are used to update user preferences.
     */
    isPreference() { return this.conversation === "@"; }   
    /**
     * Returns true if this conversation is equal to `$online` .
     *
     * Messages sent to this location are used for online status and writting status.
     * The type of message TYPE_MESSAGE is used to not store such messages.
     */ 
    isOnlineStatus() { return this.conversation === "$online"; }
    /**
     * Returns true if this message is signed.  
     */    
    isSigned(): boolean { return this.signature != null; }
    /**
     * Returns true if this message is signed with memo key.
     */ 
    isSignedWithMemo(): boolean { return this.keytype === "m";}
    /**
     * Returns true if this message is signed with posting key.
     */ 
    isSignedWithPosting(): boolean { return this.keytype === "p";}
    /**
     * Returns true if this message is signed with group key.
     *
     * Group key is used to signing and encoding private group messages.
     * A user can create a group by updating {@link Preferences} where
     * group name and group public key is stored.
     */ 
    isSignedWithGroupKey(): boolean { return this.keytype === "g";}
    /**
     * Returns true if this message is signed with guest key.
     *
     * Guest accounts sign messages with guest key which is stored in
     * user {@link Preferences}.
     */ 
    isSignedWithGuestKey(): boolean { return this.keytype === "@";}
    /**
     * Returns true if this message is signed with preferences key.
     *
     * Certain messages such as online status, writting status are signed
     * with preferences key which is stored in {@link Preferences}.     
     */
    isSignedWithPreferencesKey(): boolean { return this.keytype.startsWith("$");}
    /**
     * Returns the signature.
     */
    getSignature(): any { return this.signature;}
    /**
     * Returns the signature as hex string.    
     */
    getSignatureHex(): string { return this.signature==null?null:this.signature.toString('hex');}
    /**
     * Returns the signature as base64 string.    
     */    
    getSignatureBase64(): string { return this.signature==null?null:this.signature.toString('base64');}
    /**
     * Returns the first six bytes of signature.  
     */    
    getSignatureStart(): number {
        var signature = this.signature;
        var start = 0;
        for(var i = 0; i < 6; i++) {
            start = start << 8;
            start |= signature[i];
        }
        return start;
    }    
    /**
     * Returns a reference to this message in form of `user|timestamp`.    
     */
    getReference(): string {
        return this.getUser()+"|"+this.getTimestamp();
    }
    
    validateDataLength() { 
        //TODO 
    }
    /**
     * Returns this message in a signable text format.    
     */
    toSignableTextFormat(): string {
        var signableTextFormat = JSON.stringify(this.type) + 
          ','+JSON.stringify(this.getUserMentionsString()) + ','+JSON.stringify(this.conversation) +
          ','+JSON.stringify(this.json) + ','+JSON.stringify(this.timestamp);
        return signableTextFormat;
    }
    /**
     * Returns signable hash of this message.  
     */
    toSignableHash() {
        return Utils.dhive().cryptoUtils.sha256(this.toSignableTextFormat());
    }
    /**
     * Converts this message to array.    
     */
    toArray(): any[] {
        return [
            this.type, this.getUserMentionsString(), this.conversation, this.json,
            this.timestamp, this.keytype, this.signature.toString('hex')
        ];
    }
    /**
     * Converts this message to json string.    
     */
    toJSON(): string {
        return JSON.stringify(this.toArray());
    }
    /**
     * Created SignableMessage from json array or string.   
     */
    static fromJSON(json): SignableMessage {
        var array = (typeof json === 'string')?JSON.parse(json):json;
        var message = new SignableMessage();
        if(array.length > 0) switch(array.length) {
            default:
            case 7: message.signature = Utils.Buffer().from(array[6], 'hex');
            case 6: message.keytype = array[5];
            case 5: message.timestamp = array[4];
            case 4: message.setJSON(array[3]);
            case 3: message.setConversation(array[2]);
            case 2: message.setUser(array[1]);
            case 1: message.type = array[0];
        }
        return message;
    }
    /**
     * Encodes this message with a private group key and optional recepient public key.
     *
     * Throws error if message is not signed or conversation does not begin with `#`.
     */
    encodeWithKey(privateK: any, publicK: any = null): SignableMessage {
        if(!this.isSigned()) throw 'message is not signed';
        if(!this.isEncrypted()) throw 'message conversation does not start with #';
        var conversation = this.getConversation();        
        var i = conversation.indexOf('/');
        if(i === -1) throw 'message conversation is not valid';
        var groupOwner = conversation.substring(1, i);

        if(typeof privateK === 'string')
            privateK = Utils.dhive().PrivateKey.fromString(privateK);

        if(publicK == null) publicK = privateK.createPublic("STM"); 
        var encoded = Content.encodedMessage(this, privateK, publicK);
        
        this.setUser(groupOwner);
        this.setJSON(encoded);

        var messageHash = this.toSignableHash();
        this.keytype = 'g';
        this.signature = privateK.sign(messageHash).toBuffer();
        return this;
    }
    /**
     * Decodes this message with a private group key.    
     */
    decodeWithKey(privateK: any): SignableMessage {
        if(!this.isSignedWithGroupKey()) return this;
        var encoded = this.getContent();
        if(!(encoded instanceof Encoded)) return this;        
        if(!encoded.isEncodedWithGroup()) return this;
 
        var msg = Content.decodedMessage(encoded, privateK);
        this.setUser(msg[0]);
        this.setJSON(msg[1]);
        this.keytype = msg[2];
        this.signature = Utils.Buffer().from(msg[3], 'hex');
        return this;
    }
    /**
     * Signs message with private key.
     */
    signWithKey(privateK: any, keytype: string): SignableMessage {
        var _this = this;
        this.timestamp = Utils.utcTime();
        this.validateDataLength();

        var keytype0 = keytype.toLowerCase();
        this.keytype = (keytype0==="posting")?"p":(keytype0==="memo"?"m":keytype);
		
        if(typeof privateK === 'string')
            privateK = Utils.dhive().PrivateKey.fromString(privateK);

        var messageHash = this.toSignableHash();
        this.signature = privateK.sign(messageHash).toBuffer();
        return this;
    }
    /**
     * Signs message with keychain.
     */
    signWithKeychain(keyChainKeyType: string = 'Posting'): Promise<SignableMessage> {
        var _this = this;
        this.timestamp = Utils.utcTime();
        this.validateDataLength();

        return Utils.queueKeychain((keychain, resolve, error)=>{
            keychain.requestSignBuffer(this.getUser(),
                 this.toSignableTextFormat(), keyChainKeyType, (result)=>{
			    if(result.success) {
				    _this.keytype = keyChainKeyType.toLowerCase().charAt(0);
				    _this.signature = Utils.Buffer().from(result.result, 'hex');
				    resolve(_this);
			    }
			    else error(result);
		    });
        });
    }
    /**
     * Returns true if the signature matches the message hash.
     * 
     * For verification, it might fetch the current public posting key of a user.
     * However, if the user changed their keys after signing this message,
     * the verification can fail as previous keys are currently not handled.
     */
    async verify(): Promise<boolean> {
        var user = this.getUser();
        if(this.getMessageType() === SignableMessage.TYPE_ACCOUNT) {
            var validators = Utils.getGuestAccountValidators();
            if(this.isSignedWithGuestKey()) {
                for(var publicKey of validators)
                    if(publicKey.length >= 50 && this.verifyWithKey(publicKey)) return true;
                return false;
            }
            else {
                if(validators.indexOf(user) === -1) return false;   
            }
        }
        else if(this.getMessageType() === SignableMessage.TYPE_MESSAGE) {
            if(this.isSignedWithPreferencesKey()) {
                var accountPreferences = await Utils.getAccountPreferences(user);
                if(accountPreferences == null) return false;
                var publicKey = accountPreferences.getValueString(this.keytype);
                return (publicKey == null)?false:this.verifyWithKey(publicKey);
            }
        }
        if(this.isEncrypted() && this.isSignedWithGroupKey()) {
            var conversation = this.getConversation();
            var i = conversation.indexOf('/');
            if(i === -1) return false;
            var groupOwner = conversation.substring(1, i);
            var groupId = conversation.substring(i+1);
            if(groupOwner !== user) return false;
            var accountPreferences = await Utils.getAccountPreferences(groupOwner);
            if(accountPreferences == null) return false;
            var key = accountPreferences.getGroup(groupId);
            if(key == null) return false;
            return (key.key == null)?false:this.verifyWithKey(key.key);
        }
        else if(Utils.isGuest(user) && this.isPreference()) {
            try {
                var preferences = this.getContent();
                if(preferences instanceof Preferences) 
                    return await preferences.verifyAccount(user);
            }
            catch(e) {
                console.log(e);                    
            }
            return false;
        }
        else {
            var accountData = await Utils.getAccountData(user);
            if(accountData === null) return false;
            if(accountData === undefined) {
                console.log("error: undefined account data for user ", user);
                return false;
            }
            return this.verifyWithAccountData(accountData);
        }
    }
    /**
     * Verifies the message with account data continaing the public key of user.  
     */
    verifyWithAccountData(accountData): boolean {
        var keys = this.isSignedWithMemo()?[[accountData.memo_key]]:accountData.posting.key_auths;
		if(keys === null) return false;
        var messageHash = this.toSignableHash();
        //var signature = Signature.fromString(this.getSignature());
        var signature = Utils.dhive().Signature.fromBuffer(this.getSignature());
        for(var i = 0; i < keys.length; i++) {
			var key = Utils.dhive().PublicKey.fromString(keys[i][0]);
			if(key.verify(messageHash, signature)) return true;
		}
        return false;
    }
    /**
     * Verifies if this message is signed with given public key.
     */
    verifyWithKey(publicKey): boolean {
		//var signature = Signature.fromString(this.getSignature());
        var signature = Utils.dhive().Signature.fromBuffer(this.getSignature());
        if(typeof publicKey === 'string') 
            publicKey = Utils.dhive().PublicKey.fromString(publicKey);
		return publicKey.verify(this.toSignableHash(), signature);
    } 
    /**
     * Verifies if the user has permission to post this message.
     */  
    async verifyPermissions(): Promise<boolean> {
        return await Utils.verifyPermissions(this.getUser(), this.getMentions(), this.getConversation());
    }
}





