import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm"
import { Message } from "./Message"

@Entity()
@Index(["timestamp"])
export class UserMessage {

	@PrimaryGeneratedColumn()
    id: number

	@Column()
	@ManyToOne(type => Message)
	@JoinColumn({name:"id"})
    message: number

	@Column({type:"bigint"})
    timestamp: number

}
