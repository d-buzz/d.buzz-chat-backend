import { JSONContent } from './imports'

export class WithReference extends JSONContent {
    constructor(json: any[]) { super(json); }
    getText(): string { return this.json[1]; }    
    setText(text: string) { this.json[1] = text; }   
    getReference(): string { return this.json[2]; }    
    setReference(ref: string) { this.json[2] = ref; }   
}
