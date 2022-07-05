import { Client } from './client'
import { Community } from './community'
import { Content } from './content/imports';
import { Utils } from './utils'
import { SignableMessage } from './signable-message'
import { PermissionSet } from './permission-set'
import { DataStream } from './data-stream'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client, Community, Content, DataStream, PermissionSet,
        Utils,
        SignableMessage,
        newSignableMessage: SignableMessage.create,
        utcTime: Utils.utcTime
    };
}

