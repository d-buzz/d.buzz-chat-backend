import { SignableMessage, JSONContent } from './imports'

declare var hive_keychain: any;
export class PrivatePreferences {
    json: any
    updated: boolean = false;
    constructor(json: any) { this.json = json; }
    keys(): any {
        var json = this.json;
        var keys = json.keys;
        if(keys === undefined) 
            json.keys = keys = {};
        return keys;
    }
    setKeyFor(group: string, key: string): void {
        var keys = this.keys();
        keys[group] = key;
        this.updated = true;
    }
    getKeyFor(group: string): string {
        var keys = this.keys();
        var key = keys[group];
        return key==null?null:key;
    }
}
export class Preferences extends JSONContent {
    static readonly TYPE:string = "p";
    static readonly MAX_USER_GROUPS: number = 64;
    privatePreferences: PrivatePreferences = null
    constructor(json: any[]) { super(json); }
    getPreferencesJSON(): any { return this.json[1]; }
    /*setPreferencesJSON(json: any): void { this.json[1] = json; }*/
    newGroup(publicKey: string) {
        var groupId = this.findFreeGroupId();
        if(groupId === -1) throw "maximum limit of " + Preferences.MAX_USER_GROUPS + " groups reached";
        this.setGroup(groupId, publicKey);
        return groupId;
    }
    setGroup(groupId: number, publicKey: string): any {
        if(!(groupId >= 0 && groupId < Preferences.MAX_USER_GROUPS)) throw "out of bounds";
        var json = this.getPreferencesJSON();            
        var groups = json.groups;
        if(publicKey == null) { delete groups[groupId]; return null; }
        else { 
            groups[groupId] = { "key": publicKey };
            return groups[groupId];
        }
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
    async decodePrivatePreferencesWithKeychain(user: string, keychainKeyType: string = 'Posting') {
        var json = this.getPreferencesJSON();
        var message = json['#'];
        if(message !== undefined && typeof message === 'string') {
            var p = new Promise<string>((resolve, error)=>{
                hive_keychain.requestVerifyKey(user, message, keychainKeyType,
                    (result)=>{
                    if(result.success) {
                        var string = result.result;
                        if(string.startsWith("#")) string = string.substring(1);
                        resolve(string);
                    }
                    else error(result);
                });
            });
            var result = await p;
            this.privatePreferences = new PrivatePreferences(JSON.parse(result));
        }
        else this.privatePreferences = new PrivatePreferences({});
    }
    async getPrivatePreferencesWithKeychain(user: string, keychainKeyType: string = 'Posting'): Promise<PrivatePreferences> {
        var pref = this.privatePreferences;
        if(pref !== null) return pref;
        await this.decodePrivatePreferencesWithKeychain(user, keychainKeyType);
        return this.privatePreferences;
    }
    async encodePrivatePreferencsWithKeychan(user: string, keychainKeyType: string = 'Posting', onlyIfUpdated: boolean = true) {
        var pref = this.privatePreferences;
        if(pref == null || (onlyIfUpdated && !pref.updated)) return;
        var p = new Promise<string>((resolve, error)=>{
            hive_keychain.requestEncodeMessage(user, user, '#'+JSON.stringify(pref.json), keychainKeyType,
                (result)=>{
                if(result.success) resolve(result.result);
                else error(result);
            });
        });
        var text = await p;
        var json = this.getPreferencesJSON();
        json['#'] = text;
        pref.updated = false;
    }
    forUser(user: string, conversation: string | string[]='@'): SignableMessage {
        if(conversation !== '@') throw "conversation is not '@'";
        var pref = this.privatePreferences;
        if(pref != null && pref.updated) throw "private preference changes have not been encoded"; 
        return SignableMessage.create(user, conversation, this.json);
    }
}
