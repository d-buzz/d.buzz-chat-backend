import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { Database } from "./database"
import { SignableMessage, Utils } from '@app/stlib'

var writeFunction = null;

export class NetMethods {
    static async read(data: any): Promise<any[]> {
        const args:any = data;
        const conversation = args[1]; 

        if(conversation === '@') {
            const username = args[2];
            return await NetMethods.readPreferences(username);
        }

        const from = args[2];
        const to = args[3];

        var result: any[];
        if(conversation.startsWith("@")) 
            result = await Database.readUserMessages(conversation.substring(1), from, to);  
        else 
            result = await Database.read(conversation, from, to);        
        
        for(var i = 0; i < result.length; i++) {
            result[i] = result[i].toSignableMessageJSON();
        }
        return [true, result];
    }
    static async readPreferences(username: string): Promise<any[]> {
        const preference = await Database.readPreference(username);
        if(preference === null) return [true, null];
        return [true, preference.toSignableMessageJSON()];
    }
    static async write(data: any): Promise<any[]> {
        if(writeFunction === null) 
            return [false, "API not yet initialized."];        
        return await writeFunction(data);
    }
    static initialize(write) {
        writeFunction = write;
    }
}