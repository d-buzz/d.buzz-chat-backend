import { AppDataSource } from "../data-source"
import { Message } from "../entity/Message"
import { SignableMessage, Utils } from '@app/stlib'

export class Database {
    static async read(conversation: string, fromTimestamp: number, toTimestamp: number):Promise<any[]> {
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
    static async write(signableMessage: SignableMessage): Promise<boolean> {
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

        if(result) return false;
        if(signableMessage.verify()) {
            const message = new Message()
            message.conversation = signableMessage.getConversation();
	        message.timestamp = new Date(signableMessage.getTimestamp());
	        message.username = signableMessage.getUser();
	        message.json = signableMessage.getJSONString();
	        message.keytype = signableMessage.keytype;
	        message.signature = signableMessage.getSignature();

            await AppDataSource.manager.save(message)
            return true;
        } 
        return false;
    }

}
