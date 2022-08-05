import { Text } from './imports'

export class GroupInvite extends Text {
    static readonly TYPE:string = "g";
    constructor(json: any[]) { super(json); }
    getGroup(): string { return this.json[2]; }    
    setGroup(text: string) { this.json[2] = text; } 
    getKey(): string { return this.json[3]; }    
    setKey(text: string) { this.json[3] = text; } 
}
