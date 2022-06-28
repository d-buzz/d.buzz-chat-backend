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

	/*@DBColumn()
	@ManyToOne(type => Message, {
      onDelete: 'CASCADE',
      orphanedRowAction: "delete"
    })
	@JoinColumn({name:"id"})*/
    @ManyToOne(() => Message, (message) => message.id, {
      onDelete: 'CASCADE',
      orphanedRowAction: "delete"
    })
    message: Message

	@DBColumn({type:"timestamp"})
    timestamp: Date

    toSignableMessageJSON(): any[] {
        return this.message.toSignableMessageJSON();
    }   

}
