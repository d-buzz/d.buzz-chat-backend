import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { Database } from "./database"
import { SignableMessage, Utils } from '@app/stlib'
import { NodeSetup, NodeMethods } from "../data-source"

var accountFunction = null, writeFunction = null, connectedNodesFunction = null,
    statsFunction = null, syncFunction = null;

export class NetMethods {
    static async account(data: any): Promise<any[]> {
        if(accountFunction === null) 
            return [false, "API not yet initialized."];        
        return await accountFunction(data);
    }
    static async read(data: any): Promise<any[]> {
        const args:any = data;
        const conversation = args[1]; 

        if(conversation === '@@') {
            const username = args[2];
            return await NetMethods.readUserConversations(username);
        }

        if(conversation === '@') {
            if(args.length === 3) {
                const username = args[2];
                return await NetMethods.readPreference(username);
            }
            else if(args.length === 4) return await NetMethods.readPreferences(args[2], args[3], 100);
            else return await NetMethods.readPreferences(args[2], args[3], args[4]);
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
    static async readUserConversations(username: string): Promise<any[]> {
        const conversations = await Database.readUserConversations(username);
        if(conversations === null) return [true, null];
        return [true, conversations];
    }
    static async readPreference(username: string): Promise<any[]> {
        const preference = await Database.readPreference(username);
        if(preference === null) return [true, null];
        return [true, preference.toSignableMessageJSON()];
    }
    static async readPreferences(from: number, lastUser: string, limit: number): Promise<any[]> {
        const result:any = await Database.readPreferences(from, lastUser, limit);
        for(var i = 0; i < result.length; i++) 
            result[i] = result[i].toSignableMessageJSON();
        return [true, result, Database.preferencesChecksum()];
    }
    static async readMessages(from: number, lastId: number, limit: number): Promise<any[]> {
        const result:any = await Database.readMessages(from, lastId, limit);
        var newLastId = result.length>0?result[result.length-1].id:-1;
        for(var i = 0; i < result.length; i++) 
            result[i] = result[i].toSignableMessageJSON();
        return [true, result, newLastId];
    }
    static async write(data: any): Promise<any[]> {
        if(writeFunction === null) 
            return [false, "API not yet initialized."];        
        return await writeFunction(data);
    }
    static async sync(defaultTimeFrom: number = -1): Promise<any[]> {
        if(syncFunction === null) return [false, "API not yet initialized."];
        var time = defaultTimeFrom>=0?defaultTimeFrom:(Utils.utcTime()-30*24*60*60*1000);        
        var result = await Database.readLatest();   
        if(result != null) time = result.toTimestamp()-15*60*1000;
        var syncResult = await syncFunction(time);
        return [true, time, syncResult];
    }
    static stats(): any[] {
        return [true, statsFunction()];
    }
    static async info(): Promise<any[]> {
        return [true, { 
            "name": NodeSetup.name,
            "host": NodeSetup.host,
            "account": NodeSetup.account,
            "version": Utils.getVersion(),
            "nodes": connectedNodesFunction(),
            "preferencesChecksum": Database.preferencesChecksum(),
            "messagesChecksum": Database.messagesChecksum()
        }];
    }
    
    static initialize(account, write, nodes, stats, sync) {
        accountFunction = account;
        writeFunction = write;
        connectedNodesFunction = nodes;
        statsFunction = stats;
        syncFunction = sync;
    }
}


