import { WithReference } from './imports'

export class Edit extends WithReference {
    static readonly TYPE:string = "d";
    constructor(json: any[]) { super(json); }
    getEdit(): any { return this.json[1]; }    
    setEdit(json: any) { this.json[1] = json; }   
}
