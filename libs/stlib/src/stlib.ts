import { Client } from './client'
import { SignableMessage } from './signable-message'
declare var window: any;

if(window !== undefined) {
    window.stlib = {
        Client,
        SignableMessage,
        newSignableMessage: SignableMessage.create,
        
    };
}

