import { Content, SignableMessage, JSONContent, Utils } from './imports'
import { memo } from '@hiveio/hive-js';

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
    setKeyFor(group: string, key: string = null): void {
        var keys = this.keys();
        if(key == null) {
            if(keys[group] === undefined) return;
            delete keys[group];
            this.updated = true;
        }
        else if(keys[group] !== key) {
            keys[group] = key;
            this.updated = true;
        }
    }
    getKeyFor(group: string): string {
        var keys = this.keys();
        var key = keys[group];
        return key==null?null:key;
    }
    copy(): PrivatePreferences {
        var result = new PrivatePreferences(Utils.copy(this.json));
        result.updated = this.updated;
        return result;
    }
}
export class Preferences extends JSONContent {
    static readonly TYPE:string = "p";
    static readonly MAX_USER_GROUPS: number = 64;
    privatePreferences: PrivatePreferences = null
    constructor(json: any[]) { super(json); }
    getPreferencesJSON(): any { return this.json[1]; }
    createGuestAccount(message: any): void {
        var account = this.getAccount();
        account.message = message;
    }
    hasAccount(user: string): boolean {
        var account = this.getAccount(false);
        return account && account.message && account.message.length > 2 && account.message[2] === user;
    }
    async verifyAccount(user: string): Promise<boolean> {
        var account = this.getAccount(false);
        if(account && account.message && account.message.length >= 7 && account.message[2] === user) {
            //check if account.creator has permission to create account
            var message = SignableMessage.fromJSON(account.message);
            return await message.verify();
        }
        return false;
    }
    setCommunity(community: string, join: boolean): boolean {
        var account = this.getAccount(false);
        if(account == null) return false;
        var communities = this.getCommunities();
        var index = communities.indexOf(community);
        if(join) {
            if(index === -1) {
                communities.push(community);
                account.communities = communities;
                return true;
            }
        }
        else {
            if(index !== -1) {
                communities.splice(index, 1);
                account.communities = communities;
                return true;
            }
        }
        return false;
        
    }
    getCommunities() {
        var account = this.getAccount(false);
        if(account && account.communities != null)
            return account.communities;
        return [];        
    }
    getValueBoolean(name: string, def: boolean = false): boolean {
        var value = this.getValues()[name+":b"];
        return (value===undefined)?def:value;
    }
    getValueString(name: string, def: string = null): string {
        var value = this.getValues()[name+":s"];
        return (value===undefined)?def:value;
    }
    getValue(nameColonType: string, def: any = null): any {
        var value = this.getValues()[nameColonType];
        return (value===undefined)?def:value;
    }
    setValue(nameColonType: string, value: any = null) {
        var values = this.getValues();
        if(value == null) delete values[nameColonType];
        else values[nameColonType] = value;
    }
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
    getAccount(create:boolean = true): any { return this.getValueSet('account', create); } 
    getValues(create:boolean = true): any { return this.getValueSet('values', create); }
    getGroups(create:boolean = true): any { return this.getValueSet('groups', create); }
    getValueSet(name: string, create:boolean = true): any {
        var json = this.getPreferencesJSON();
        var set = json[name];
        if(create && set === undefined) 
            json[name] = set = {};
        return set;
    }
    findFreeGroupId(): number {
        var groups = this.getGroups();
        for(var i = 0; i < Preferences.MAX_USER_GROUPS; i++)
            if(groups[i] === undefined) return i;
        return -1;
    }
    getPrivatePreferencesWithKey(privateK: string): PrivatePreferences {
        var pref = this.privatePreferences;
        if(pref !== null) return pref;
        var json = this.getPreferencesJSON();
        var message = json['#'];
        if(message !== undefined && typeof message === 'string') {
            var result = memo.decode(privateK, message);
            if(result.startsWith("#")) result = result.substring(1);
            this.privatePreferences = new PrivatePreferences(JSON.parse(result));
        }
        else this.privatePreferences = new PrivatePreferences({});
        return this.privatePreferences;
    }
    encodePrivatePreferencesWithKey(privateK: string, publicK: string, onlyIfUpdated: boolean = true) {
        var pref = this.privatePreferences;
        if(pref == null || (onlyIfUpdated && !pref.updated)) return;
        var text = memo.encode(privateK, publicK, "#"+JSON.stringify(pref.json));
        var json = this.getPreferencesJSON();
        json['#'] = text;
        pref.updated = false;
    }
    async getPrivatePreferencesWithKeychain(user: string, keychainKeyType: string = 'Posting'): Promise<PrivatePreferences> {
        var pref = this.privatePreferences;
        if(pref !== null) return pref;
        var json = this.getPreferencesJSON();
        var message = json['#'];
        if(message !== undefined && typeof message === 'string') {
            var result = await Content.decodeTextWithKeychain(user, message, keychainKeyType);
            this.privatePreferences = new PrivatePreferences(JSON.parse(result));
        }
        else this.privatePreferences = new PrivatePreferences({});
        return this.privatePreferences;
    }
    async encodePrivatePreferencesWithKeychan(user: string, keychainKeyType: string = 'Posting', onlyIfUpdated: boolean = true) {
        var pref = this.privatePreferences;
        if(pref == null || (onlyIfUpdated && !pref.updated)) return;
        var p = Utils.queueKeychain((keychain, resolve, error)=>{
            keychain.requestEncodeMessage(user, user, '#'+JSON.stringify(pref.json), keychainKeyType,
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
    copy(): Preferences {
        var result = super.copy();
        var privatePreferences = this.privatePreferences;
        if(privatePreferences != null) result.privatePreferences = privatePreferences.copy();
        return result;
    }
}
