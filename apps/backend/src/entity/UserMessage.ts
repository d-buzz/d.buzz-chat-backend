import { Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { DBColumn } from "../utils/utils.module"
import { Message } from "./Message"

@Entity()
@Index(["username", "timestamp"])
export class UserMessage {

	@PrimaryGeneratedColumn()
    id: number

	@DBColumn({type:"varchar",length:20})
    username: string
    
    @ManyToOne(() => Message, (message) => message.id, {
      onDelete: 'CASCADE',
      orphanedRowAction: "delete"
    })
    message: Message

	@DBColumn({type:"timestamp"})
    timestamp: Date

    toTimestamp(): number {
        var time:any = this.timestamp;
        if(typeof time === 'string' && time.length > 0 && time[time.length-1] !== 'Z')
            time += 'Z';
        return new Date(time).getTime();
    }

    toSignableMessageJSON(): any[] {
        return this.message.toSignableMessageJSON();
    }   

}
