import { Entity, PrimaryGeneratedColumn, Unique, Index, Column, PrimaryColumn } from "typeorm"
import { DBColumn } from "../utils/utils.module"

@Entity()
@Index(["username", "timestamp"])
export class Preference {

    @PrimaryColumn({type:"varchar",length:20})
    username: string

    @DBColumn({type:"timestamp"})
    timestamp: Date

	@DBColumn({type:"json",length:2048})
    json: string

	@DBColumn({type:"char",length:1})
    keytype: string

    @DBColumn({type:"bytea"})
    signature: Buffer

    toTimestamp(): number {
        var time:any = this.timestamp;
        if(typeof time === 'string' && time.length > 0 && time[time.length-1] !== 'Z')
            time += 'Z';
        return new Date(time).getTime();
    }
    toSignableMessageJSON(): any {
        return ["w", this.username, '@', this.json,
          this.toTimestamp(),
          this.keytype, this.signature.toString('hex')];
    }
}
