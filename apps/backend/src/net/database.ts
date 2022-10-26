import { AppDataSource } from "../data-source"
import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { Community, SignableMessage, Utils } from '@app/stlib'
import { UserMessage } from "../entity/UserMessage"
import { MessageStats } from "../utils/utils.module"

export class Database {
    static async read(conversation: string, fromTimestamp: number,
             toTimestamp: number, limit: number = 100):Promise<Message[]> {
        if(!(limit >= 1 && limit <= 100)) limit = 100;
        const parameters = {
            conversation: conversation, 
            from: new Date(fromTimestamp),
            to: new Date(toTimestamp)
        };
        return await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .where("m.conversation = :conversation")
            .andWhere("m.timestamp BETWEEN :from AND :to")
            .orderBy("m.timestamp", "DESC")
            .limit(limit)
            .setParameters(parameters)
            .getMany(); 
    }
    static async readPreference(username: string): Promise<Preference> {
        return await AppDataSource 
            .getRepository(Preference)
            .createQueryBuilder("p")
            .where("p.username = :username")
            .setParameter("username", username)
            .getOne();
    }
    static async readUserConversations(username: string): Promise<any[]> {
        const parameters = {
            username,
            from: new Date(Utils.utcTime()-30*24*60*60*1000)
        };
        var arrayRaw = await AppDataSource 
            .getRepository(UserMessage)
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.message", "m")
            .where("u.username = :username")
            .andWhere("u.timestamp > :from")
            .select("m.conversation")
            .distinct(true)
            //.orderBy("u.timestamp", "DESC")
            .limit(10000)
            .setParameters(parameters)
            .getRawMany();

        var result = [];
        for(var row of arrayRaw) result.push(row.m_conversation);
        return result;
    }
    static async readUserMessages(username: string, fromTimestamp: number, toTimestamp: number): Promise<any[]> {
        const parameters = {
            username: username, 
            from: new Date(fromTimestamp),
            to: new Date(toTimestamp)
        };
        return await AppDataSource 
            .getRepository(UserMessage)
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.message", "message")
            .where("u.username = :username")
            .andWhere("u.timestamp BETWEEN :from AND :to")
            .orderBy("u.timestamp", "DESC")
            .limit(100)
            .setParameters(parameters)
            .getMany();
    }
    static async write(signableMessage: SignableMessage): Promise<any[]> {
        if(signableMessage.isPreference()) 
            return await Database.writePreference(signableMessage);
        return await Database.writeMessage(signableMessage);
    }
    static async writePreference(signableMessage: SignableMessage): Promise<any[]> {
        var username = signableMessage.getUser();
        var timestamp = new Date(signableMessage.getTimestamp());
        var json = signableMessage.getJSONString();
        var keytype = signableMessage.keytype;
        var signature = signableMessage.getSignature();

        var preferenceObj = await Database.readPreference(username);
        if(preferenceObj === null || preferenceObj.timestamp < timestamp) {
            var verifiedResult = await signableMessage.verify();
            if(!verifiedResult) return [false, 'error: message did not verify.'];
        } 
        else return [false, 'error: timestamp is not greater than ' + preferenceObj.timestamp];

        var preference = new Preference();
        preference.username = username;
        preference.timestamp = timestamp;
        preference.json = json;
        preference.keytype = keytype;
        preference.signature = signature;

        var result = await AppDataSource 
            .getRepository(Preference)
            .createQueryBuilder("p")
            .insert()
            .values([preference])
            .onConflict(`("username") 
                DO UPDATE SET "timestamp" = EXCLUDED.timestamp,
                    "json" = EXCLUDED.json, "keytype" = EXCLUDED.keytype,
                    "signature" = EXCLUDED.signature
                WHERE "p"."timestamp" < EXCLUDED.timestamp
                RETURNING "p"."timestamp"
             `)
        .execute();
        var includedOrUpdated = result.raw.length > 0;
        return includedOrUpdated?[true, null]:[false, 'warning: already present.'];
    }
    static async writeMessage(signableMessage: SignableMessage): Promise<any[]> {
        var timestamp = signableMessage.getTimestamp();
        var signature = signableMessage.getSignature();

        var parameters = {
            signature,
            time: new Date(timestamp)
        };
        var result = await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .where("m.signature = :signature")
            .andWhere("m.timestamp = :time")
            .setParameters(parameters)
            .getOne();

        if(result) return [false, 'warning: already present.'];
        var verifiedResult = await signableMessage.verify();
        if(verifiedResult) {
            //check if can send
            var conversation = signableMessage.getConversation();
            if(signableMessage.isCommunityConversation()) {
                var communityName = signableMessage.getConversationUsername();
                var communityStreamId = conversation.substring(communityName.length+1);
                var community = await Community.load(communityName);
                var stream = community.findTextStreamById(communityStreamId);
                if(stream !== null) {
                    var writePermissions = stream.getWritePermissions();
                    if(!writePermissions.isEmpty()) {
                        var dataCache = Utils.getStreamDataCache();
                        var role = await dataCache.getRole(communityName, signableMessage.getUser());
                        var titles = await dataCache.getTitles(communityName, signableMessage.getUser());
                        if(!writePermissions.validate(role, titles)) 
                            return [false, 'permission.'];
                    }
                }
            }

            const message = new Message();
            message.conversation = signableMessage.getConversation();
	        message.timestamp = new Date(signableMessage.getTimestamp());
	        message.username = signableMessage.getUser();
	        message.json = signableMessage.getJSONString();
	        message.keytype = signableMessage.keytype;
	        message.signature = signableMessage.getSignature();

            var savedMessage = await AppDataSource.manager.save(message);
            if(signableMessage.isGroupConversation()) {
                var groupUsernames = signableMessage.getGroupUsernames();
                if(groupUsernames.length >= 2 && groupUsernames.length <= 4) {
                    var userMessages = [];
                    for(var user of groupUsernames) {
                        var userMessage = new UserMessage();
                        userMessage.username = user;
                        userMessage.message = savedMessage;
                        userMessage.timestamp = savedMessage.timestamp;
                        userMessages.push(userMessage);
                    }
                    await AppDataSource.manager.save(userMessages);
                }            
            }            

            return [true, null];
        } 
        return [false, 'message did not verify.'];
    }
    static async readStats(stats: MessageStats, fromTimestamp: number, toTimestamp: number) {
        const parameters = {
            from: new Date(fromTimestamp),
            to: new Date(toTimestamp)
        };
        var messages = await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .where("m.timestamp BETWEEN :from AND :to")
            .setParameters(parameters)
            .getMany();
        for(var message of messages) {
            var conversation = message.conversation;
            var timestamp = new Date(message.timestamp).getTime();
            if(conversation.startsWith('hive-')) {
                var i = conversation.indexOf('/');
                if(i !== -1) stats.add(conversation.substring(0, i), timestamp);
            }
        }
    }
    static async readLatest():Promise<Message> {
        return await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .orderBy("m.timestamp", "DESC")
            .getOne(); 
    }
}
