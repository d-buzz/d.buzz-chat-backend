import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from "typeorm"

@Entity()
@Unique(["signature"])
@Index(["timestamp"])
@Index(["conversation", "timestamp"])
export class Message {

    @PrimaryGeneratedColumn()
    id: number

    @Column({type:"varchar", length:64})
    conversation: string

	@Column({type:"bigint"})
    timestamp: number

	@Column({type:"varchar",length:32})
    username: string

	@Column({type:"varchar",length:2048})
    json: string

	@Column({type:"char",length:1})
    keytype: string

    @Column({type:"varchar",length:130})
    signature: string
    
}
