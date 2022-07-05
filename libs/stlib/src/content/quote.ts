import { WithReference } from './imports'

export class Quote extends WithReference {
    static readonly TYPE:string = "q";
    constructor(json: any[]) { super(json); }
    getFrom(): string { return this.json[3]; }    
    getTo(): string { return this.json[4]; }    
    setFromTo(from: number, to: number) { 
        this.json[3] = from;
        this.json[4] = to;
    }    
}
