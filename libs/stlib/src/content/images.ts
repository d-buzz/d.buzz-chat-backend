import { JSONContent } from './imports'

export class Images extends JSONContent {
    static readonly TYPE:string = "i";
    constructor(json: any[]) { super(json); }
    addImage(image: string) { this.json.push(image); }
    getImage(index: number): string { return this.json[index+1]; }    
    setImage(index: number, image: string) { this.json[index+1] = image; } 
    length(): number { return this.json.length-1; }
}
