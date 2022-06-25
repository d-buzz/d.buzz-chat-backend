import { Utils } from './utils'

/*
    Represents data path in the following format '<type>:<path>'
    For example text channel number 1 in community hive-1111111, can
    be written as TYPE_TEXT+':hive-1111111/1'

    The following compact form is abstracted by the implementation.
    As text channels will be most common, and community is known, they
    can be represented in the shortened form '1'
    Community information such as about section, can be represented with
    TYPE_INFO+':hive-1111111/about' and in short form '/about'
*/
export class DataPath {
    static TYPE_INFO:string = "i"
    static TYPE_TEXT:string = "t"
    type: string
    user: string
    path: string

    constructor(type: string, community: string, path: string) {
        this.type = type;
        this.user = community;
        this.path = path;
    }
    getType(): string { return this.type; }
    getUser(): string { return this.user; }
    getPath(): string { return this.path; }
    /* compact form representation */
    static fromString(text: string, community: string) {
        if(text === null || text.length === 0) return null;            
        if(Utils.isWholeNumber(text)) 
            return new DataPath(DataPath.TYPE_TEXT, community, text);
        var typeI = text.indexOf(':');
        var type = null;
        if(typeI !== -1) {
            type = text.substring(0, typeI);
            text = text.substring(typeI+1);
        }
        var slash = text.indexOf('/');
        if(slash === 0) 
            return new DataPath(DataPath.TYPE_INFO, community, text.substring(1));
        if(text.startsWith("hive-") && slash !== -1) {
            community = text.substring(0,slash);
            text = text.substring(slash+1);
            if(Utils.isWholeNumber(text)) type = DataPath.TYPE_TEXT;
        }
        return new DataPath((type===null)?DataPath.TYPE_INFO:type,
             community, text);
    }        
    toString(community: string) {
        if(this.user === community) {
            if(this.type === DataPath.TYPE_TEXT && Utils.isWholeNumber(this.path))
                return this.path;
            if(this.type === DataPath.TYPE_INFO) return '/'+this.path;
            return this.type+':/'+this.path;
        }
        if(this.type === DataPath.TYPE_INFO) return this.user+'/'+this.path;
        return this.type+':'+this.user+'/'+this.path;
    }
}
    

