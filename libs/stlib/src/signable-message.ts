import { Content } from './content'
import { Utils } from './utils'
type JSONContent = Content.JSONContent;
declare var dhive: any;
declare var hive_keychain: any;

export class SignableMessage {
    type: string
    user: string    
    conversation: string
    json: string
    timestamp: number
    keytype: string
    signature: Buffer

    constructor() {
        this.type = "w";
    }
    static create(user: string,conversation: string | string[],json: any): SignableMessage {
        var s = new SignableMessage();
        s.setUser(user);
        s.setConversation(conversation);
        s.setJSON(json);
        return s;
    }
    
    setUser(user: string) { this.user = user;}
    setConversation(a: string | string[]) {
        if(Array.isArray(a)) this.setConversationGroup(a); 
        else this.conversation = a;
    }
    setConversationGroup(usernames: string[]) { 
        if(!(usernames.length > 1 && usernames.length <= 4))
            throw "Group Conversation requires [2-4] users."
        usernames.sort();
        this.conversation = usernames.join('|');
    }
    setJSON(js: any) { 
        this.json = (js.toJSON !== undefined)?js.toJSON(): 
            ((typeof js === 'string')?js:JSON.stringify(js));
    }

    getMessageType(): string { return this.type; }
    getUser(): string { return this.user; }
    getConversation(): string { return this.conversation; }
    getJSONString(): string { return this.json; }
    getContent(): JSONContent { return Content.fromJSON(JSON.parse(this.json)); }
    getTimestamp(): number { return this.timestamp;}
    getGroupUsernames(): string[] { return this.conversation.split('|'); }
    isGroupConversation(): boolean { return this.conversation.indexOf('|') !== -1; }
    isEncrypted() { return this.conversation === "#"; }
    isPreference() { return this.conversation === "@"; }    
    isSigned(): boolean { return this.signature != null; }
    isSignedWithMemo(): boolean { return this.keytype === "m";}
    isSignedWithPosting(): boolean { return this.keytype === "p";}
    getSignature(): Buffer { return this.signature;}
    getReference(): string {
        return this.getUser()+"|"+this.getTimestamp();
    }
    
    validateDataLength() { 
        //TODO 
    }
    toSignableTextFormat(): string {
        var signableTextFormat = JSON.stringify(this.type) + 
          ','+JSON.stringify(this.user) + ','+JSON.stringify(this.conversation) +
          ','+JSON.stringify(this.json) + ','+JSON.stringify(this.timestamp);
        return signableTextFormat;
    }
    toSignableHash() {
        return dhive.cryptoUtils.sha256(this.toSignableTextFormat());
    }
    toArray() {
        return [
            this.type, this.user, this.conversation, this.json,
            this.timestamp, this.keytype, this.signature.toString('hex')
        ];
    }
    toJSON() {
        return JSON.stringify(this.toArray());
    }
    static fromJSON(json): SignableMessage {
        var array = (typeof json === 'string')?JSON.parse(json):json;
        var message = new SignableMessage();
        message.type = array[0];
        message.setUser(array[1]);
        message.setConversation(array[2]);
        message.setJSON(array[3]);
        message.timestamp = array[4];
        message.keytype = array[5];
        message.signature = Buffer.from(array[6], 'hex');
        return message;
    }
    signWithKey(privateK: any, keytype: string): SignableMessage {
        var _this = this;
        this.timestamp = Utils.utcTime();
        this.validateDataLength();

        var keytype0 = keytype.toLowerCase();
        this.keytype = (keytype0==="posting")?"p":(keytype0==="memo"?"m":keytype);
		
        if(typeof privateK === 'string')
            privateK = dhive.PrivateKey.fromString(privateK);

        var messageHash = this.toSignableHash();
        this.signature = privateK.sign(messageHash).toBuffer();
        return this;
    }
    signWithKeychain(keyChainKeyType: string): Promise<SignableMessage> {
        var _this = this;
        this.timestamp = Utils.utcTime();
        this.validateDataLength();

        var p = new Promise<SignableMessage>((resolve, error)=>{
            hive_keychain.requestSignBuffer(this.getUser(),
                 this.toSignableTextFormat(), keyChainKeyType, (result)=>{
			    if(result.success) {
				    _this.keytype = keyChainKeyType.toLowerCase().charAt(0);
				    _this.signature = Buffer.from(result.result, 'hex');
				    resolve(_this);
			    }
			    else error(result);
		    });
        });
        return p;
    }
    async verify(): Promise<boolean> {
        if(this.isEncrypted()) {
            var conversation = this.getConversation();
            var i = conversation.indexOf('/');
            if(i === -1) return false;
            var groupOwner = conversation.substring(0, i);
            var groupId = conversation.substring(i+1);
            var accountPreferences = await Utils.getAccountPreferences(groupOwner);
            if(accountPreferences == null) return false;
            var key = accountPreferences.getGroup(groupId);
            return (key == null)?false:this.verifyWithKey(key);
        }
        else {
            var user = this.getUser();
            var accountData = await Utils.getAccountData(user);
            if(accountData === null) return false;
            return this.verifyWithAccountData(accountData);
        }
    }
    verifyWithAccountData(accountData): boolean {
        var keys = this.isSignedWithMemo()?[[accountData.memo_key]]:accountData.posting.key_auths;
		if(keys === null) return false;
        var messageHash = this.toSignableHash();
        //var signature = Signature.fromString(this.getSignature());
        var signature = dhive.Signature.fromBuffer(this.getSignature());
        for(var i = 0; i < keys.length; i++) {
			var key = dhive.PublicKey.fromString(keys[i][0]);
			if(key.verify(messageHash, signature)) return true;
		}
        return false;
    }
    verifyWithKey(publicKey): boolean {
		//var signature = Signature.fromString(this.getSignature());
        var signature = dhive.Signature.fromBuffer(this.getSignature());
        if(typeof publicKey === 'string') 
            publicKey = dhive.PublicKey.fromString(publicKey);
		return publicKey.verify(this.toSignableHash(), signature);
    }    
}




