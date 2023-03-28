import { SignableMessage } from '../signable-message'
import { Utils } from '../utils'
import * as Content from './content'
import { JSONContent } from './jsoncontent'
import { Encoded } from './encoded'
import { Text } from './text'
import { GroupInvite } from './group-invite'
import { Images } from './images'
import { OnlineStatus } from './online-status'
import { WithReference } from './with-reference'
import { Thread } from './thread'
import { Quote } from './quote'
import { Edit } from './edit'
import { Emote } from './emote'
import { Flag } from './flag'
import { Mention } from './mention'
import { Preferences, PrivatePreferences } from './preferences'
//import { Group } from './group'

Content.addType(Text);          //'t'
Content.addType(Thread);        //'h'
Content.addType(Quote);         //'q'
Content.addType(Edit);          //'d'
Content.addType(Emote);         //'e'
Content.addType(Flag);          //'f'
Content.addType(Images);        //'i'
Content.addType(GroupInvite);   //'g'
Content.addType(Preferences);   //'p'
Content.addType(Encoded);       //'x'
Content.addType(OnlineStatus);  //'o'
Content.addType(Mention);       //'m'
export {
    SignableMessage,
    Content,
    JSONContent,
    Encoded,
    GroupInvite,
    Images,
    Text,
    WithReference,
    Thread,
    Mention,
    OnlineStatus,
    Quote,
    Edit,
    Emote,
    Flag,
    Preferences,
    PrivatePreferences,
    Utils
}
