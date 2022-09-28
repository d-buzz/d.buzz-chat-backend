import { Content, JSONContent, Text } from './imports'

export class Thread extends Text {
    static readonly TYPE:string = "h";
    cachedContent: JSONContent = null
    constructor(json: any[]) { super(json); }
    getName(): string { return this.json[1]; }    
    setName(text: string) { this.json[1] = text; } 
    getContent(): JSONContent { 
        var content = this.cachedContent;
        if(content !== null) return content;
        content = Content.fromJSON(this.json[2]);
        this.cachedContent = content;   
        return content;
    }    
    setContent(json: any[]) { this.cachedContent = null; this.json[2] = json; }
}
