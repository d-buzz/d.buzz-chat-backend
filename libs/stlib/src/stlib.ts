import { Client } from './client'
import { Community } from './community'
import { Content } from './content/imports'
import { DisplayableEmote, DisplayableMessage } from './displayable-message'
import { MessageManager, EventQueue } from './message-manager'
import { LastReadRecord, LastRead } from './manager/last-read'
import { LocalUserStorage, EncodedPublicStorage } from './manager/user-storage'
import { Markdown } from './markdown'
import { Utils, TransientCache } from './utils'
import { SignableMessage } from './signable-message'
import { PermissionSet } from './permission-set'
import { DataStream } from './data-stream'
import { DataPath } from './data-path'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client, Community, Content, DataStream, DataPath, DisplayableEmote, DisplayableMessage, 
        EventQueue, PermissionSet, Markdown, MessageManager, Utils, SignableMessage, TransientCache,
        newSignableMessage: SignableMessage.create,
        utcTime: Utils.utcTime,
        manager: {
            LastReadRecord, LastRead,
            LocalUserStorage, EncodedPublicStorage
        }
    };
}

