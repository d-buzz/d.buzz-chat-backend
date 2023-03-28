import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { Database } from "./database"
import { Community, OnlineStatus, SignableMessage, Utils } from '@app/stlib'
import { NodeSetup, NodeMethods } from "../data-source"

var accountFunction = null, writeFunction = null, connectedNodesFunction = null,
    statsFunction = null, syncFunction = null;
var onlineStatus = {};
export class NetMethods {
    static async account(data: any): Promise<any[]> {
        if(accountFunction === null) 
            return [false, "API not yet initialized."];        
        return await accountFunction(data);
    }
    static async availableAccount(accountName: string): Promise<any[]> {
        if(!Utils.isValidGuestName(accountName)) return [false, 'invalid account name.'];
        var userNumber = Utils.parseGuest(accountName);
        if(userNumber.length == 2 && Database.isGuestAccountAvailable(accountName)) {}
        else accountName = await Database.findUnusedGuestAccount(userNumber[0]);
        if(!accountName) return [false, 'account name unavailable.'];
        return [true, accountName];
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

        if(conversation === '$online') {
            if(typeof args[2] === 'string') return NetMethods.readOnlineStatusForCommunity(args[2], args[3]);
            return NetMethods.readOnlineStatus(args[2], args[3]);
        }

        var from = -1, to = -1, lastId = -1, limit = 100;
        switch(args.length) {
            default:
            case 6: limit = args[5];
            case 5: lastId = args[4];
            case 4: to = args[3];
            case 3: from = args[2];
        }

        var result: any[];
        if(conversation.startsWith("@")) 
            result = await Database.readUserMessages(conversation.substring(1), from, to, lastId, limit);  
        else if(conversation.startsWith("&")) 
            result = await Database.readMentions(conversation.substring(1), from, to, lastId, limit);  
        else 
            result = await Database.read(conversation, from, to, lastId, limit);  
      
        var newLastId = result.length>0?result[result.length-1].id:-1;
        for(var i = 0; i < result.length; i++) {
            result[i] = result[i].toSignableMessageJSON();
        }
        return [true, result, newLastId];
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
    static async readOnlineStatus(usernames: string[], maxTimestamp: number = 0): Promise<any[]> {
        var result = [];
        for(var i = 0; i < usernames.length; i++) {
            var message = onlineStatus[usernames[i]];
            if(message != null && message[0][4] >= maxTimestamp)
                result.push(message[0]);
        }
        return [true, result];
    }
    static async readOnlineStatusForCommunity(community: string, maxTimestamp: number = 0): Promise<any[]> {
        var result = [];
        for(var user in onlineStatus) {
            var message = onlineStatus[user];
            if(message && message[0][4] >= maxTimestamp && message[1] &&
             message[1].indexOf(community) !== -1)
                result.push(message[0]);
        }
        return [true, result];
    }
    static async readCommunity(username: string): Promise<any[]> {
        var community = await Community.load(username);
        if(community === null) return [true, null];
        //var joined = await community.listJoined();
        return [true, [community.toJSON(), null]];
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
    static stats(conversations: string[] = null): any[] {
        return [true, statsFunction(conversations)];
    }
    static async info(): Promise<any[]> {
        return [true, { 
            "name": NodeSetup.name,
            "host": NodeSetup.host,
            "account": NodeSetup.account,
            "version": Utils.getVersion(),
            "nodes": connectedNodesFunction(),
            "preferencesChecksum": Database.preferencesChecksum(),
            "messagesChecksum": Database.messagesChecksum(),
            "time": Utils.utcTime()
        }];
    }
    static setOnlineStatus(message: SignableMessage) {
        var content = message.getContent();
        if(content instanceof OnlineStatus)
            onlineStatus[message.getUser()] = [message.toArray(), content.getCommunities()];
    }
    static initialize(account, write, nodes, stats, sync) {
        accountFunction = account;
        writeFunction = write;
        connectedNodesFunction = nodes;
        statsFunction = stats;
        syncFunction = sync;
    }
}


