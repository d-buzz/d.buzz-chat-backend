import { Client } from './client'
import { Community } from './community'
import { Content } from './content/imports'
import { DisplayableEmote, DisplayableMessage } from './displayable-message'
import { MessageManager, EventQueue } from './message-manager'
import { Utils, TransientCache } from './utils'
import { SignableMessage } from './signable-message'
import { PermissionSet } from './permission-set'
import { DataStream } from './data-stream'
import { DataPath } from './data-path'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client, Community, Content, DataStream, DataPath, DisplayableEmote, DisplayableMessage, 
        EventQueue, PermissionSet, MessageManager, Utils, SignableMessage, TransientCache,
        newSignableMessage: SignableMessage.create,
        utcTime: Utils.utcTime
    };
}

