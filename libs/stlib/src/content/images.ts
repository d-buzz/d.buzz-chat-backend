import { JSONContent } from './imports'

export class Images extends JSONContent {
    static readonly TYPE:string = "i";
    constructor(json: any[]) { super(json); }
    getText() { 
        var json = this.json;
        var text = json[1]; 
        for(var i = 2; i < json.length; i++)
            text += " " + json[i];
        return text;
    }
    setText(text: string) {
        var arr = text.trim().split(/\s+/);
        this.json = [this.json[0], ...arr];
    }
    addImage(image: string) { this.json.push(image); }
    getImage(index: number): string { return this.json[index+1]; }    
    setImage(index: number, image: string) { this.json[index+1] = image; } 
    length(): number { return this.json.length-1; }
}
