import { Entity, PrimaryGeneratedColumn, Unique, Index, Column, PrimaryColumn } from "typeorm"
import { DBColumn } from "../utils/utils.module"

@Entity()
export class Preference {

    @PrimaryColumn({type:"varchar",length:20})
    username: string

    @Column({type:"timestamp"})
    timestamp: Date

	@DBColumn({type:"json",length:2048})
    json: string

	@DBColumn({type:"char",length:1})
    keytype: string

    @DBColumn({type:"bytea"})
    signature: Buffer

    toSignableMessageJSON(): any {
        return ["w", this.username, '@', this.json,
          new Date(this.timestamp).getTime(),
          this.keytype, this.signature.toString('hex')];
    }
}
