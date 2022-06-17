import { Entity, PrimaryGeneratedColumn, Unique, Index } from "typeorm"
import { DBColumn } from "../utils/utils.module"

@Entity()
@Unique(["signature"])
@Index(["timestamp"])
@Index(["conversation", "timestamp"])
export class Message {

    @PrimaryGeneratedColumn()
    id: number

    @DBColumn({type:"varchar", length:256})
    conversation: string

	@DBColumn({type:"bigint"})
    timestamp: number

	@DBColumn({type:"varchar",length:32})
    username: string

	@DBColumn({type:"json",length:2048})
    json: string

	@DBColumn({type:"char",length:1})
    keytype: string

    @DBColumn({type:"varchar",length:130})
    signature: string
    
}
