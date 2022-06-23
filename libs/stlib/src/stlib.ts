import { Client } from './client'
import { Utils } from './utils'
import { SignableMessage } from './signable-message'
import { PermissionSet } from './permission-set'
import { Community } from './community'
import { DataStream } from './data-stream'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client, Community, DataStream, PermissionSet,
        Utils,
        SignableMessage,
        newSignableMessage: SignableMessage.create,
        utcTime: Utils.utcTime
    };
}

