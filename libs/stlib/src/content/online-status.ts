import { JSONContent } from './imports'

export class OnlineStatus extends JSONContent {
    static readonly TYPE:string = "o";
    constructor(json: any[]) { super(json); }
    isOnline(): boolean { return this.getStatus() != null && this.getStatus() != false;}
    setOnline(value: any = true) { this.setStatus(value); }
    getStatus(): any { return this.json[1]; }    
    setStatus(value: any) { this.json[1] = value; } 
}
