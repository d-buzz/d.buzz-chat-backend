import { AppDataSource } from "../data-source"
import { Message } from "../entity/Message"
import { Preference } from "../entity/Preference"
import { Community, SignableMessage, Utils, TransientCache } from '@app/stlib'
import { UserMessage } from "../entity/UserMessage"
import { MentionMessage } from "../entity/MentionMessage"
import { MessageStats } from "../utils/utils.module"

var preferencesCheckSum = null;
var messagesCheckSum: TransientCache = null;
var users = {};
var writeInProgress = {};
export class Database {
    static async read(conversation: string,
         fromTimestamp: number = -1, toTimestamp: number = -1,
         lastId: number = -1, limit: number = 100): Promise<Message[]> {
        if(!(limit >= 1 && limit <= 100)) limit = 100;
        const parameters = {
            conversation: conversation, 
            from: new Date(fromTimestamp),
            to: new Date(toTimestamp)
        };
        return await Database.pagination(
            AppDataSource.getRepository(Message)
            .createQueryBuilder("u")
            .where("u.conversation = :conversation"), { conversation },
            fromTimestamp, toTimestamp, lastId, limit
        );   
    }
    static async readMessages(fromTimestamp: number, lastId: number, limit: number = 100): Promise<Message[]> {
        if(!(limit >= 1 && limit <= 100)) limit = 100;
        const parameters = {
            from: new Date(fromTimestamp),
            lastId: lastId
        };
        return await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .where("m.timestamp > :from OR (m.timestamp = :from AND m.id > :lastId)")
            .orderBy("m.timestamp", "ASC")
            .addOrderBy("m.id", "ASC")
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
    static async readPreferences(fromTimestamp: number,
             lastUser: string = "", limit: number = 100): Promise<Preference[]> {
        if(!(limit >= 1 && limit <= 100)) limit = 100;
        if(lastUser == null) lastUser = "";
        const parameters = {
            from: new Date(fromTimestamp),
            user: lastUser
        };
        return await AppDataSource 
            .getRepository(Preference)
            .createQueryBuilder("p")
            .where("p.timestamp > :from OR (p.timestamp = :from AND p.username > :user)")
            .orderBy("p.timestamp", "ASC")
            .addOrderBy("p.username", "ASC")
            .limit(limit)
            .setParameters(parameters)
            .getMany();
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
    static async readUserMessages(username: string, 
            fromTimestamp: number = -1, toTimestamp: number = -1,
            lastId: number = -1, limit: number = 100): Promise<any[]> {
        if(!(limit >= 1 && limit <= 100)) limit = 100;    
        return await Database.pagination(
            AppDataSource.getRepository(UserMessage)
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.message", "message")
            .where("u.username = :username"), { username }, 
            fromTimestamp, toTimestamp, lastId, limit
        );
    }
    static async readMentions(username: string, fromTimestamp: number, toTimestamp: number = -1,
            lastId: number, limit: number = 100): Promise<Message[]> {
        if(!(limit >= 1 && limit <= 100)) limit = 100;      
        return await Database.pagination(
            AppDataSource.getRepository(MentionMessage)
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.message", "message")
            .where("u.username = :username"), { username },
            fromTimestamp, toTimestamp, lastId, limit
        );   
    }
    static async pagination(query: any, parameters: any, fromTimestamp: number = -1, toTimestamp: number = -1,
            lastId: number = -1, limit: number = 100): Promise<any[]> {
        var order = "DESC";
        if(fromTimestamp === -1 && toTimestamp === -1) {}
        else {
            parameters.from = new Date(fromTimestamp);
            parameters.to = new Date(toTimestamp);
            parameters.lastId = lastId;
            var where = (toTimestamp !== -1 && lastId !== -1)?" OR (u.timestamp = :to AND u.id < :lastId)":"";
            if(fromTimestamp !== -1 && toTimestamp !== -1) 
                where = "(u.timestamp > :from AND u.timestamp < :to)"+where;
            else if(toTimestamp !== -1)  
                where = "u.timestamp < :to" + where;
            else if(fromTimestamp !== -1) {
                where = "(u.timestamp > :from) OR (u.timestamp = :from AND u.id > :lastId)";
                order = "ASC";        
            }
            query = query.andWhere(where);
        }
        return await query
            .orderBy("u.timestamp", order)
            .addOrderBy("u.id", order)
            .limit(limit)
            .setParameters(parameters)
            .getMany();
    }
    static async write(signableMessage: SignableMessage): Promise<any[]> {
        if(signableMessage.isPreference()) 
            return await Database.writePreference(signableMessage);
        return await Database.writeMessage(signableMessage);
    }
    static async writePreference(signableMessage: SignableMessage, verify: boolean = true): Promise<any[]> {
        var username = signableMessage.getUser();
        var timestamp = new Date(signableMessage.getTimestamp());
        var json = signableMessage.getJSONString();
        var keytype = signableMessage.keytype;
        var signature = signableMessage.getSignature();

        var preferenceObj = await Database.readPreference(username);
        if(preferenceObj === null || preferenceObj.timestamp < timestamp) {
            if(verify) {
                var verifiedResult = await signableMessage.verify();
                if(!verifiedResult) return [false, 'error: message did not verify.'];
            }
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
        if(includedOrUpdated) {
            var time = signableMessage.getTimestamp();
            var currentPreferences = users[username];
            if(currentPreferences === undefined) preferencesCheckSum.count++;
            else Utils.xorArray(preferencesCheckSum.xor, currentPreferences.signature as any, preferencesCheckSum.xor);
            Utils.xorArray(preferencesCheckSum.xor, signature as any, preferencesCheckSum.xor);
            users[username] = preference;
            if(time > preferencesCheckSum.time || 
                (time === preferencesCheckSum.time && username > preferencesCheckSum.user)) {
                preferencesCheckSum.user = username;
                preferencesCheckSum.time = time;
            }
        }
        return includedOrUpdated?[true, null]:[false, 'warning: already present.'];
    }
    static async writeMessage(signableMessage: SignableMessage, verifyPermissions: boolean = true,
             verify: boolean = true): Promise<any[]> {
        var timestamp = signableMessage.getTimestamp();
        var signature = signableMessage.getSignature();

        var signatureTimestamp = signature.toString('hex')+'#'+timestamp;
        if(writeInProgress[signatureTimestamp]) return [false, 'warning: processing.'];
        try {
            writeInProgress[signatureTimestamp] = true;

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
            var verifiedResult = (verify)?(await signableMessage.verify()):true;
            if(verifiedResult) {
                //check if can send
                if(verifyPermissions) {
                    var verifyResult = await signableMessage.verifyPermissions();
                    if(!verifyResult) return [false, 'permission.'];
                }

                const message = new Message();
                message.conversation = signableMessage.getConversation();
	            message.timestamp = new Date(signableMessage.getTimestamp());
	            message.username = signableMessage.getUser();
                message.mentions = signableMessage.getMentionsString();
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
                else if(signableMessage.hasMentions()) {
                    var mentionUsernames = signableMessage.getMentions();
                    if(mentionUsernames.length >= 1 && mentionUsernames.length <= 12) {
                        var mentionMessages = [];
                        for(var user of mentionUsernames) {
                            var mentionMessage = new MentionMessage();
                            mentionMessage.username = user;
                            mentionMessage.message = savedMessage;
                            mentionMessage.timestamp = savedMessage.timestamp;
                            mentionMessages.push(mentionMessage);
                        }
                        await AppDataSource.manager.save(mentionMessages);
                    }
                }     

                messagesCheckSum.add(signableMessage.getTimestamp(), message);  

                return [true, null];
            } 
            return [false, 'message did not verify.'];
        }
        finally {
            delete writeInProgress[signatureTimestamp];
        }
    }
    static async initialize(stats: MessageStats) {
        try { preferencesCheckSum = await Database.preferencesCountAndXorHash(null, users); }
        catch(e) { console.log(e); }
        //30 day cache by hour
        messagesCheckSum = await Database.messagesCountAndXorHash(stats);
    }
    static isGuestAccountAvailable(account: string): boolean {
        if(!Utils.isGuest(account)) return false;
        return (users[account] === undefined);
    }
    static async findUnusedGuestAccount(account: string, validateFn: (a)=>Promise<any> = null): Promise<string> {
        var to = account.length===16?1000:10000;
        for(var i = 0; i < to; i++) 
            if(Database.isGuestAccountAvailable(account+Utils.GUEST_CHAR+i) &&
                (validateFn == null || (await validateFn(account+Utils.GUEST_CHAR+i)))) 
                return account+Utils.GUEST_CHAR+i;
        return null;
    }
    static preferencesChecksum(): PreferencesChecksum { return preferencesCheckSum; }
    static messagesChecksum(): any { return messagesCheckSum.items; }
    static messagesChecksumCache(): TransientCache { return messagesCheckSum; }
    static async preferencesCountAndXorHash(toTimestamp: number = null, initUsers: any = null): Promise<PreferencesChecksum> {
        var builder:any = AppDataSource 
            .getRepository(Preference)
            .createQueryBuilder("p");

        if(toTimestamp != null) {
            const parameters = {
                to: new Date(toTimestamp),
            };
            builder = builder
                .where("p.timestamp <= :to")
                .setParameters(parameters);
        }
        var data = await builder
            .orderBy("p.timestamp", "ASC")
            .addOrderBy("p.username", "ASC")
            .getMany();
        var result = new PreferencesChecksum();
        result.count = data.length;
        var signatureXor = new Array(65).fill(0);
        for(var item of data) 
            Utils.xorArray(signatureXor, item.signature, signatureXor);
        result.xor = signatureXor;
        if(data.length > 0) { 
            var lastItem = data[data.length-1];
            result.user = lastItem.username;
            result.time = lastItem.toTimestamp();
        }
        if(initUsers != null) {
            for(var item of data) initUsers[item.username] = item;
        }
        return result;
    }
    static async messagesCountAndXorHash(stats: MessageStats): Promise<any> {
        var duration = 30*24*60*60*1000;
        var binDuration = 60*60*1000;
        var cache = new TransientCache(duration, binDuration, ()=>{return new MessagesChecksum();});
        var now = Utils.utcTime();
        var fromTimestamp = now-duration-binDuration;
        const parameters = {
            from: new Date(fromTimestamp)
        };
        var messages = await AppDataSource 
            .getRepository(Message)
            .createQueryBuilder("m")
            .where("m.timestamp >= :from")
            .setParameters(parameters)
            .getMany();
        for(var message of messages) {
            cache.add(message.toTimestamp(), message);

            var conversation = message.conversation;
            if(Utils.isCommunityConversation(conversation) ||
                Utils.isJoinableGroupConversation(conversation)) {
                var timestamp = new Date(message.timestamp).getTime();
                stats.updateLast(conversation, timestamp);
            }
        }
        return cache;
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


    static async testAddPreferences(): Promise<number> {
        var usernames = ['aaa','bbb','ddd','eee'];
        var added = 0;
        for(var username of usernames) {
            for(var i = 0; i < 10; i++) {
                var preference = new Preference();
                preference.username = username+i;
                preference.timestamp = new Date(i+1);
                preference.json = "test";
                preference.keytype = "p";
                preference.signature = Buffer.from("123");

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
                if(result.raw.length > 0) added += result.raw.length;
            }
        }
        return added;
    }
}
export class PreferencesChecksum {
    count: number
    xor: number[]
    user: string = ""
    time: number = 0
    matches(checksum: any): boolean {
        return (this.user === checksum.user 
            && this.time === checksum.time 
            && Utils.arrayEquals(this.xor, checksum.xor));
    }
}
export class MessagesChecksum {
    count: number = 0
    xor: number[] = new Array(65).fill(0)
    user: string = ""
    time: number = 0
    add(time: number, message: Message) {
        if(this.count === 0 || time > this.time) { 
            this.user = message.username;
            this.time = time;
        }
        this.count++;
        Utils.xorArray(this.xor, message.signature as any, this.xor);
    }
    matches(checksum: any): boolean {
        return (this.user === checksum.user 
            && this.time === checksum.time 
            && Utils.arrayEquals(this.xor, checksum.xor));
    }
}





