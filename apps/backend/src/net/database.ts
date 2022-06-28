import { AppDataSource } from "../data-source"
import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { SignableMessage, Utils } from '@app/stlib'
import { UserMessage } from "../entity/UserMessage"

export class Database {
    static async read(conversation: string, fromTimestamp: number, toTimestamp: number):Promise<Message[]> {
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
            .limit(100)
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

}
