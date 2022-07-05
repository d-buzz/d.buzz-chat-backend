import { JSONContent } from './imports'

export class Text extends JSONContent {
    static readonly TYPE:string = "t";
    constructor(json: any[]) { super(json); }
    getText(): string { return this.json[1]; }    
    setText(text: string) { this.json[1] = text; } 
}
