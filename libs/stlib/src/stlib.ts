import { Client } from './client'
import { Utils } from './utils'
import { SignableMessage } from './signable-message'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client,
        Utils,
        SignableMessage,
        newSignableMessage: SignableMessage.create,
        utcTime: Utils.utcTime
    };
}

