import { WithReference } from './imports'

export class Emote extends WithReference {
    static readonly TYPE:string = "e";
    constructor(json: any[]) { super(json); }
}
