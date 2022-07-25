import { Client } from './client'
import { Community } from './community'
import { Content } from './content/imports'
import { DisplayableMessage } from './displayable-message'
import { MessageManager } from './message-manager'
import { Utils } from './utils'
import { SignableMessage } from './signable-message'
import { PermissionSet } from './permission-set'
import { DataStream } from './data-stream'
import { DataPath } from './data-path'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client, Community, Content, DataStream, DataPath, DisplayableMessage, 
        PermissionSet, MessageManager, Utils, SignableMessage,
        newSignableMessage: SignableMessage.create,
        utcTime: Utils.utcTime
    };
}

