import { SignableMessage } from '../signable-message'
import { Utils } from '../utils'
import * as Content from './content'
import { JSONContent } from './jsoncontent'
import { Encoded } from './encoded'
import { Text } from './text'
import { GroupInvite } from './group-invite'
import { Images } from './images'
import { WithReference } from './with-reference'
import { Thread } from './thread'
import { Quote } from './quote'
import { Edit } from './edit'
import { Emote } from './emote'
import { Preferences, PrivatePreferences } from './preferences'
//import { Group } from './group'

Content.addType(Text);
Content.addType(Thread);
Content.addType(Quote);
Content.addType(Edit);
Content.addType(Emote);
Content.addType(Images);
Content.addType(GroupInvite);
Content.addType(Preferences);
Content.addType(Encoded);
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
    Quote,
    Edit,
    Emote,
    Preferences,
    PrivatePreferences,
    Utils
}
