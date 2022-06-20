import { Entity, PrimaryGeneratedColumn, Unique, Index, Column } from "typeorm"
import { DBColumn } from "../utils/utils.module"

//	@Column({type:"timestamp", precision:8})

@Entity()
@Unique(["timestamp", "signature"])
@Index(["timestamp"])
@Index(["conversation", "timestamp"])
export class Message {

    @PrimaryGeneratedColumn()
    id: number

    @DBColumn({type:"varchar", length:84})
    conversation: string

    @Column({type:"timestamp"})
    timestamp: Date

	@DBColumn({type:"varchar",length:20})
    username: string

	@DBColumn({type:"json",length:2048})
    json: string

	@DBColumn({type:"char",length:1})
    keytype: string

    @DBColumn({type:"bytea"})
    signature: Buffer
    
}
