import { Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { DBColumn } from "../utils/utils.module"
import { Message } from "./Message"

@Entity()
@Index(["username", "timestamp"])
export class UserMessage {

	@PrimaryGeneratedColumn()
    id: number

	@DBColumn({type:"varchar",length:32})
    username: string

	@DBColumn()
	@ManyToOne(type => Message)
	@JoinColumn({name:"id"})
    message: number

	@DBColumn({type:"bigint"})
    timestamp: number

}
