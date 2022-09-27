import { Text } from './imports'

export class Thread extends Text {
    static readonly TYPE:string = "h";
    constructor(json: any[]) { super(json); }
    getName(): string { return this.json[1]; }    
    setName(text: string) { this.json[1] = text; } 
    setContent(): any[] { return this.json[2]; }    
    getContent(json: any[]) { this.json[2] = json; }  
}
