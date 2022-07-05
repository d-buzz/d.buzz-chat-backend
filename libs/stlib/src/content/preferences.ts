import { SignableMessage, JSONContent } from './imports'

export class Preferences extends JSONContent {
    static readonly TYPE:string = "p";
    static readonly MAX_USER_GROUPS: number = 64;
    constructor(json: any[]) { super(json); }
    getPreferencesJSON(): any { return this.json[1]; }
    setPreferencesJSON(json: any): void { this.json[1] = json; }
    newGroup(publicKey: string) {
        var groupId = this.findFreeGroupId();
        if(groupId === -1) throw "maximum limit of " + Preferences.MAX_USER_GROUPS + " groups reached";
        this.setGroup(groupId, publicKey);
        return groupId;
    }
    setGroup(groupId: number, publicKey: string) {
        if(!(groupId >= 0 && groupId < Preferences.MAX_USER_GROUPS)) throw "out of bounds";
        var json = this.getPreferencesJSON();            
        var groups = json.groups;
        if(publicKey == null) delete groups[groupId];
        else groups[groupId] = { "key": publicKey };
    }
    getGroup(groupId: number): any {
        var groups = this.getGroups();
        var group = groups[groupId];
        return group==null?null:group;
    }
    getGroups(): any {
        var json = this.getPreferencesJSON();
        var groups = json.groups;
        if(groups === undefined) 
            json.groups = groups = {};
        return groups;
    }
    findFreeGroupId(): number {
        var groups = this.getGroups();
        for(var i = 0; i < Preferences.MAX_USER_GROUPS; i++)
            if(groups[i] === undefined) return i;
        return -1;
    }
    forUser(user: string, conversation: string | string[]='@'): SignableMessage {
        if(conversation !== '@') throw "conversation is not '@'";
        return SignableMessage.create(user, conversation, this.json);
    }
}
