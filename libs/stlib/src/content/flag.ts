import { WithReference } from './imports'

export class Flag extends WithReference {
    static readonly TYPE:string = "f";
    constructor(json: any[]) { super(json); }
}
