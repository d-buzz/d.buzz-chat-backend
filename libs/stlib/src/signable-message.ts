import { Utils } from './utils'
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
    static create(user: string,conversation: string,json: any): SignableMessage {
        var s = new SignableMessage();
        s.setUser(user);
        s.setConversation(conversation);
        s.setJSON(json);
        return s;
    }
    
    setUser(user: string) { this.user = user;}
    setConversation(a: string) { this.conversation = a;}
    setJSON(js: any) { this.json = (typeof js === 'string')?js:JSON.stringify(js);}

    getMessageType(): string { return this.type; }
    getUser(): string { return this.user; }
    getConversation(): string { return this.conversation; }
    getJSONString(): string { return this.json; }
    getTimestamp(): number { return this.timestamp;}
    isSigned(): boolean { return this.signature != null; }
    isSignedWithMemo(): boolean { return this.keytype === "m";}
    isSignedWithPosting(): boolean { return this.keytype === "p";}
    getSignature(): Buffer { return this.signature;}
    
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
    toJSON() {
        return JSON.stringify([
            this.type, this.user, this.conversation, this.json,
            this.timestamp, this.keytype, this.signature.toString('hex')
        ]);
    }
    static fromJSON(json): SignableMessage {
        var array = JSON.parse(json);
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
    signWithKeychain(keyChainKeyType: string, callback: (SignableMessage, any) => void): Promise<SignableMessage> {
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
        var user = this.getUser();
        var accountData = await Utils.getAccountData(user);
        if(accountData === null) return false;
        return this.verifyWithAccountData(accountData);
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




