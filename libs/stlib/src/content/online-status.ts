import { JSONContent } from './imports'

export class OnlineStatus extends JSONContent {
    static readonly TYPE:string = "o";
    constructor(json: any[]) { super(json); }
    isOnline(): boolean { return this.getStatus() != null && this.getStatus() != false;}
    setOnline(value: any = true) { this.setStatus(value); }
    getStatus(): any { return this.json[1]; }    
    setStatus(value: any) { this.json[1] = value; }
    setCommunities(value: string[]) { this.json[2] = value; }
    getCommunities() { return this.json[2]; }
    setLastReadNumber(n: number) { this.json[3] = n; }
    getLastReadNumber() { return this.json[3] || 0; }
    setLastReadTimestamp(timestamp: number) { this.json[4] = timestamp; }
    getLastReadTimestamp() { return this.json[4] || 0; }
}
