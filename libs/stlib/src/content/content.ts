import { 
    SignableMessage, JSONContent, Encoded, GroupInvite, Images, Text, WithReference,
    Thread, OnlineStatus, Quote, Edit, Emote, Flag, Mention, Preferences, PrivatePreferences, Utils
} from './imports'


var supportedTypes = {};
/**
 * Adds new custom type which extends JSONContent.
 *
 * The new type is to extend JSONContent and contain static variable TYPE
 * with a string containing the type id. Type is is to be unique, if it is not
 * an existing type will be overriden. 
 *
 * A list of currently imported types include:
 * Content.addType(Text);          //'t'
 * Content.addType(Thread);        //'h'
 * Content.addType(Quote);         //'q'
 * Content.addType(Edit);          //'d'
 * Content.addType(Emote);         //'e'
 * Content.addType(Flag);          //'f'
 * Content.addType(Images);        //'i'
 * Content.addType(GroupInvite);   //'g'
 * Content.addType(Preferences);   //'p'
 * Content.addType(Encoded);       //'x'
 * Content.addType(OnlineStatus);  //'o'
 * Content.addType(Mention);       //'m'
 *
 */
export function addType(type: typeof JSONContent, typeString: string = null) {
    if(typeString === null) typeString = type['TYPE'];
    if(typeString == null) throw "unknown type"; 
    if(supportedTypes[typeString] !== undefined) 
        console.log("warning: redeclaring type: ", typeString);
    supportedTypes[typeString] = type;
}
/**
 * Retrieves type from JSONContent in json form.
 *
 * Returns the first argument of json array or null if it is not an array or has no elements.
 */
export function type(content: any): string {
    if(Array.isArray(content) && content.length > 0) return content[0];
    return null;
}  
/**
 * Parses JSONContent from json array.
 *
 * example usage:
 * var textContent = Content.fromJSON(['t', 'hi']);
 */
export function fromJSON(json): JSONContent {        
    var ty = type(json);
    if(ty === null) return null;
    var result = supportedTypes[ty];
    return result == null?null:new result(json);
}
/**
 * Creates new Text content from message.
 */
export function text(message: string): Text {
    return new Text([Text.TYPE, message]);        
}
/**
 * Creates new Images content from array of links.
 */
export function images(...images: string[]): Images {
    return new Images([Images.TYPE, ...images]);        
}
/**
 * Creates new Thread content with given thread name and JSONContent or json array.
 */
export function thread(threadName: string, content: any): Thread {
    if(content instanceof JSONContent) content = content.toJSON();
    return new Thread([Thread.TYPE, threadName, content]);        
}  
/**
 * Creates new Quote content with message quoting a SignableMessage.
 *
 * Optionally quoteFrom and quoteTo can be set to partially quote
 * a section of message.
 */
export function quote(message: string, parentMessage: SignableMessage,
    quoteFrom: number = 0, quoteTo: number = -1): Quote {
    return new Quote([Quote.TYPE,
        message, 
        parentMessage.getReference(),
        quoteFrom, quoteTo
    ]);        
}
/**
 * Creates new Edit content with edited JSONContent and SignableMessage to edit.
 *
 */
export function edit(editedContent: JSONContent, parentMessage: SignableMessage): Edit {
    return new Edit([Edit.TYPE, editedContent==null?null:editedContent.toJSON(), 
        parentMessage.getReference()
    ]);        
}
/**
 * Creates new Emote content with unicode emote or link to emote image and SignableMessage respond to.
 *
 */
export function emote(emote: string, parentMessage: SignableMessage): Emote {
    return new Emote([Emote.TYPE, emote, 
        parentMessage.getReference()
    ]);        
}
/**
 * Creates new Flag content with reason for flagging a SignableMessage.
 *
 */
export function flag(reason: string, parentMessage: SignableMessage): Emote {
    return new Flag([Flag.TYPE, reason, 
        parentMessage.getReference()
    ]);        
}
/**
 * Creates new GroupInvite content with message, group and private key of the group.
 * 
 * GroupInvite content is to be encoded and send as a direct message.
 * Do not send group invite content to public channels as that would make the group public.
 *
 */
export function groupInvite(message: string, group: string, key: string): Text {
    return new GroupInvite([GroupInvite.TYPE, message, group, key]);        
} 
/**
 * Creates new Preferences content.
 */
export function preferences(json: any = {}): Preferences {
    return new Preferences([Preferences.TYPE, json]);        
}
/**
 * Creates new OnlineStatus content with online message.
 *
 * The online message can be set to "true", "writing", null.
 * If set to "true" or null, send the conversation to '$online' to update the online status.
 * eg:
 * var conversation = '$online';
 * var msg = SignableMessage.create(user, conversation, 
 *       Content.onlineStatus("true", communities, lastReadNum, lastReadTimestamp),
 *        SignableMessage.TYPE_MESSAGE);
 *
 * The type of SignableMessage is set to SignableMessage.TYPE_MESSAGE for online status.
 *
 * If message is set to "writing", set the conversation in which to update the writing status.
 * eg.: conversation = 'hive-1111111/0'
 *
 * @param online online message: "true", "writing", null
 * @param communities array of communities where the user will appear online
 * @param lastReadNum number of unread messages
 * @param lastReadTimestamp current timestamp in milliseconds
 */
export function onlineStatus(online: any, communities: string[],
         lastReadNum: number, lastReadTimestamp: number): OnlineStatus {
    return new OnlineStatus([OnlineStatus.TYPE, online, communities, lastReadNum, lastReadTimestamp]);        
}
/**
 * Encodes text with private key and public key.
 */
export function encodeTextWithKey(text: string, privateK: any, publicK: any): string {
    return Utils.encodeTextWithKey(text, privateK, publicK);
}
/**
 * Decodes text with private key.
 */
export function decodeTextWithKey(text: string, privateK: any): string {
    return Utils.decodeTextWithKey(text, privateK);
}
/**
 * Encodes SignableMessage with private key and public key.
 */
export function encodedMessage(msg: SignableMessage, privateK: any, publicK: any): Encoded {
    var string = JSON.stringify([msg.getUserMentionsString(), msg.getJSONString(), msg.keytype, msg.getSignature().toString('hex')]);            
    var encoded = [Encoded.TYPE, 'g', Utils.encodeTextWithKey(string, privateK, publicK)];    
    return new Encoded(encoded);
}
/**
 * Decodes Encoded content with private key.
 */
export function decodedMessage(msg: Encoded, privateK: any): any[] {
    return JSON.parse(Utils.decodeTextWithKey(msg.json[2], privateK));
}
/**
 * Encodes text with keychain.
 */
export async function encodeTextWithKeychain(user: string, message: string, keychainKeyType: string = 'Posting'): Promise<string> {
    var p = Utils.queueKeychain((keychain, resolve, error)=>{
        keychain.requestEncodeMessage(user, user, '#'+message, keychainKeyType,
            (result)=>{
            if(result.success) resolve(result.result);
            else error(result);
        });
    });
    return await p;
}
/**
 * Decodes text with keychain.
 */
export async function decodeTextWithKeychain(user: string, message: string, keychainKeyType: string = 'Posting'): Promise<string> {
   var p = Utils.queueKeychain((keychain, resolve, error)=>{
        keychain.requestVerifyKey(user, message, keychainKeyType,
            (result)=>{
            if(result.success) {
                var string = result.result;
                if(string.startsWith("#")) string = string.substring(1);
                resolve(string);
            }
            else error(result);
        });
    });
    return await p;
}
export {
    JSONContent, Edit, Encoded, Flag, GroupInvite, Images, Mention, Text, 
    WithReference, Thread, Quote, OnlineStatus,
    Emote, Preferences, PrivatePreferences
}

