import { WithReference } from './imports'

export class Thread extends WithReference {
    static readonly TYPE:string = "h";
    constructor(json: any[]) { super(json); }
}
