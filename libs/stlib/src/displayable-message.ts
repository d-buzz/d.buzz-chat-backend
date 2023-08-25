import { Content, Encoded, Edit, Emote, Flag, JSONContent, Thread } from './content/imports'
import { SignableMessage } from './signable-message'
import { Utils } from './utils'

/**
  * DisplayableMessage wraps a SignableMessage and prepares it for displaying.
  *
  * Prior to displaying a message, signature verification, resolving of 
  * references, handling edited content, edit history, emote reactions,
  * flags can take place. This class contains the results of these operations
  * suitable for displaying.
  *
  */
export class DisplayableMessage {
  /**
   * The SignableMessage this DisplayableMessage is wrapping.
   */
  message: SignableMessage
  /**
    * Reference of DisplayableMessage this message is referencing. For example
    * a message with Content.Quote can reference a message to quote.
    */
  reference: DisplayableMessage = null
  /**
    * The edit history of this message or null.
    */
  edits: DisplayableMessage[] = null
  /**
    * List of emote responses.
    */
  emotes: DisplayableEmote[] = null
  /**
    * List of flags.
    */
  flags: DisplayableFlag[] = null
  /**
    * Sum of flag weights.
    */
  flagsNum: number = 0
  /**
    * Parsed content of this message.
    */
  content: JSONContent
  /**
    * True if verified, false if failed verification, null if pending.
    */
  verified: boolean
  /**
    * Cached call to message.getGroupUsernames()
    */
  usernames: string[]
  /**
    * Contains edited content
    */
  editContent: JSONContent = null
  /**
    * True if this message content is instanceof Edit
    */
  isEdit: boolean = false

  /**
    * Creates a new instance of DisplayableMessage
    *
    * @param message signable message
    */
  constructor(message: SignableMessage) {
    this.message = message;
    this.content = undefined;
    this.verified = null;
  }

  /**
    * Initializes the DisplayableMessage
    */
  init(): void {
    this.usernames = this.message.getGroupUsernames();
    var content = this.content;
    if(content) {
      if(content instanceof Thread) {
        var threadContent = content.getContent();
        if(threadContent instanceof Edit) {
          var editContent = threadContent.getEdit();
          this.editContent = Content.thread(content.getName(), (editContent == null)?null:Content.fromJSON(editContent));                    
          this.isEdit = true;
        }
      }
      else if(content instanceof Edit) { 
        var editContent = content.getEdit();
        this.editContent = (editContent == null)?null:Content.fromJSON(editContent);
        this.isEdit = true;
      }
    }
  }

  /**
    * Returns the index of emote response of -1 if there is none.
    *
    * @param emote 
    */
  getEmoteIndex(emote: string): number {
    if(this.emotes === null) return -1;
    for(var i = 0; i < this.emotes.length; i++)
      if(this.emotes[i].emote === emote)
        return i;
    return -1;
  }

  /**
    * Adds emote response.
    *
    * @param msg DisplayableMessage with content Content.Emote
    */
  emote(msg: DisplayableMessage) {
    var content = msg.content;
    if(!(content instanceof Emote)) return;
    if(this.emotes === null) this.emotes = [];
    var timestamp = msg.getTimestamp();
    var emote = content.getText();
    var emoteIndex = this.getEmoteIndex(emote);
    var obj;
    if(emoteIndex === -1) { 
      obj = new DisplayableEmote(emote,timestamp);
      this.emotes.push(obj);            
    }
    else obj = this.emotes[emoteIndex];
    obj.add(msg);
    this.emotes.sort((a,b)=>b.timestamp-a.timestamp);
  }

  /**
    * Adds flag response.
    *
    * @param msg DisplayableMessage with content Content.Flag
    */
  async flag(msg: DisplayableMessage) {
    var content = msg.content;
    if(!(content instanceof Flag)) return;
    if(this.flags === null) this.flags = [];
    for(var flag of this.flags)
      if(msg.getUser() === flag.user) return; 
    this.flags.push(new DisplayableFlag(msg.getUser(), content.getText(), msg));
    var communityConversation = msg.getCommunity();
    if(communityConversation) this.flagsNum += await Utils.getFlagNum(communityConversation, msg.getUser());
    else this.flagsNum++;
  }

  /**
    * Returns true if this content is inside a thread.
    */
  isThread(): boolean {
    return this.getEditedContent() instanceof Thread;
  }

  /**
    * Returns thread name if this content is inside a thread or null otherwise.
    */
  getThreadName(): string {
    var content = this.getEditedContent();
    return (content instanceof Thread)?content.getName():null;
  }

  /**
    * Returns true if this content of type Content.Emote.
    */
  isEmote(): boolean {
    return this.content instanceof Emote;
  }

  /**
    * Returns true if this content is of type Flag.
    */
  isFlag(): boolean {
    return this.content instanceof Flag;
  }

  /**
    * Adds an edit to this message.
    */
  edit(msg: DisplayableMessage) {
    if(this.edits === null) this.edits = [msg];
    else {
      if(this.edits.indexOf(msg) !== -1) return; //TODO compare actual data
      this.edits.push(msg);
      this.edits.sort((a,b)=>b.getTimestamp()-a.getTimestamp());
    }
  }

  /**
    * Returns true if this message contains an unresolved reference.
    */
  isUnresolvedReference(): boolean {
    return this.reference == null && this.isEmote() || this.isFlag() || this.content instanceof Edit;
  }
  

  /**
    * Returns true if the message's conversation contains username.
    *
    * @param user
    */
  hasUser(user: string) { return this.usernames.indexOf(user) !== -1; }
  

  /**
    * Returns the user associated with message signature.
    */
  getUser(): string { return this.message.user; }  

  /**
    * Returns the conversation.
    */
  getConversation(): string { return this.message.conversation; }  

  /**
    * Returns the timestamp.
    */
  getTimestamp(): number { return this.message.timestamp; }


  /**
    * Returns the community name this convesation is in or null if it is not a community message.
    */
  getCommunity(): string { 
    var conversation = this.getConversation();
    if(conversation && conversation.startsWith("hive-")) {
      var i = conversation.indexOf('/');
      return i===-1?conversation:conversation.substring(0,i);
    }
    return null;
  }  

  /**
    * Returns true if the content type is Content.Encode.
    *
    *
    */
  isEncoded(): boolean {
    return this.content instanceof Encoded;
  }

  /**
    * Returns the edited content.
    */
  getEditedContent(): JSONContent {
    var edits = this.edits;
    if(edits !== null && edits.length > 0) return edits[0].editContent;
    return this.content;
  }

  /**
    * Returns the content to display. If there are edits, the newest
    * edit of this content is returned. If the content is inside a thread
    * the thread content is returned.
    */
  getContent(): JSONContent {
    var content = this.getEditedContent();
    if(content instanceof Thread) return content.getContent();
    return content;
  }

  /**
    * Returns true if this message is verified, false otherwise.
    */
  isVerified(): boolean {
    var edits = this.edits;
    var value = null;
    if(edits !== null && edits.length > 0) value = edits[0].verified;
    else value = this.verified;
    if(value === true) return true;
    return false;
  }
}

/**
  * DisplayableEmote represents a list of emote responses to a message.
  */
export class DisplayableEmote {
  /**
    * Unicode emote or link to emote image.
    */
  emote: string
  /**
    * List of users who responded with this emote.
    */
  users: string[] = []
  /**
    * List of DisplayableMessage containing Emote content responses.
    */
  messages: DisplayableMessage[] = []
  /**
    * The minimum timestamp from messages.
    */
  timestamp: number

  /**
    * Creates a new DisplayableEmote
    *
    * @param emote Unicode emote or link to emote image
    * @timestamp message timestamp
    */
  constructor(emote: string, timestamp: number) {
    this.emote = emote;
    this.timestamp = timestamp;
  }

  /**
    * Add DisplayableMessage with Emote content type.
    *
    * @param msg DisplayableMessage with Emote content.
    */
  add(msg: DisplayableMessage) {
    var user = msg.getUser();
    if(this.users.indexOf(user) === -1)
      this.users.push(user);
    this.messages.push(msg);
    this.timestamp = Math.min(this.timestamp, msg.getTimestamp());   
  }
}

/**
  * DisplayableFlag represents a list of flag responses to a message.
  *
  */
export class DisplayableFlag {
  /**
    * User posting a Flag message.
    */
  user: string
  /**
    * Reason for flagging a message.
    */
  reason: string
  /**
    * 
    */
  message: DisplayableMessage

  /**
    * Creates a new DisplayableFlag message.
    *
    * @param user user who has posted a Flag message
    * @param reason reason for flagging a message
    * @param message DisplayableMessage with Flag content
    */
  constructor(user: string, reason: string, message: DisplayableMessage) {
    this.user = user;
    this.reason = reason;
    this.message = message;
  }
}

