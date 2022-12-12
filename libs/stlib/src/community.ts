import { DataStream } from './data-stream'
import { DataPath } from './data-path'
import { Utils } from './utils'

export class Community {
    static readonly MAX_TEXT_STREAMS: number = 64;

    communityData: any
    streams: DataStream[] 
    joined: Promise<string[][]> = null

    initialize(communityData: any) {
        this.communityData = communityData;
        var settings = this.getSettings();
        if(settings.streams === undefined) {
            this.streams = Community.defaultStreams(this.getName());
            return;
        }
        this.streams = [];
        for(var stream of settings.streams) 
            this.streams.push(DataStream.fromJSON(this.getName(), stream));
    }   

    getName() { return this.communityData.name; }
    getTitle() { return this.communityData.title; }
    getAbout() { return this.communityData.about; }
    getDescription() { return this.communityData.description; }
    getRules() { return this.communityData.flag_text; }
    getSettings() { return this.communityData.settings; }
    getStreams(): DataStream[] { return this.streams; }
    setStreams(streams: DataStream[]): void { this.streams = streams;}
    addStream(stream: DataStream): void { this.streams.push(stream);}
    canSetRole(username: string, account: string, role: string): boolean {
        var userRoleIndex = Community.roleToIndex(this.getRole(account));
        var roleToSetIndex = Community.roleToIndex(role);
        if(roleToSetIndex === -1) return false;
        var userRole = this.getRole(username);
        if(!userRole) return false;
        var roleIndex = Community.roleToIndex(userRole);
        return roleIndex >= 5 && roleIndex >= userRoleIndex && roleIndex > roleToSetIndex;
    }
    canSetTitles(username: string): boolean {
        var userRole = this.getRole(username);
        if(!userRole) return false;
        var roleIndex = Community.roleToIndex(userRole);
        return roleIndex >= 5;
    }
    canUpdateSettings(user: string): boolean {
        var userRole = this.getRole(user);
        if(!userRole) return false;
        var roleIndex = Community.roleToIndex(userRole);
        return roleIndex > 5;
    }
    getRole(username: string): string { 
        var role = this.getRoleEntry(username);
        return role==null?null:role[1];
    }
    setRole(username: string, role: string) {
        var roleEntry = this.getOrCreateRoleEntry(username);
        roleEntry[1] = role;
    }
    getTitles(username: string): string[] { 
        var role = this.getRoleEntry(username);
        return role==null?null:role[2];
    }
    setTitles(username: string, titles: string[]) {
        var roleEntry = this.getOrCreateRoleEntry(username);
        roleEntry[2] = titles;
    }
    hasTitle(username: string, title: string): boolean {
        var titles = this.getTitles(username);
        return titles===null?false:titles.indexOf(title)!==-1;
    }

    getRoleEntry(username: string): any {
        var roles = this.communityData.roles;
        if(roles == null)  return null;        
        var role = roles[username];
        return role==null?null:role;        
    }
    getOrCreateRoleEntry(username: string): any {
        var roles = this.communityData.roles;
        if(roles == null) this.communityData.roles = roles = {};
        var role = roles[username];
        if(role == null) roles[username] = role = [username, null, null];
        return role;        
    }

    newCategory(name: string): DataStream { 
        var category = DataStream.fromJSON(this.getName(), [name]);
        this.addStream(category);
        return category;
    }
    newTextStream(name: string, path: string = null): DataStream {
        if(path === null) {
            var groupId = this.findFreeTextStreamId();
            if(groupId === -1) throw "maximum limit of " +
                 Community.MAX_TEXT_STREAMS + " text streams reached";
            path = ''+groupId;
        }
        var stream = DataStream.fromJSON(this.getName(), [name, path]);
        this.addStream(stream);
        return stream;
    }
    newInfo(name: string, path: string): DataStream { 
        var info = DataStream.fromJSON(this.getName(), [name, path]);
        this.addStream(info);
        return info;
    }
    findFreeTextStreamId(): number {
        var name = this.getName();
        var streams = this.getStreams();
        loop:
        for(var i = 0; i < Community.MAX_TEXT_STREAMS; i++) {
            for(var stream of streams) {
                if(stream.hasPath()) {
                    var path = stream.getPath();
                    if(path.getType() === DataPath.TYPE_TEXT &&
                       path.getUser() === name &&
                       path.getPath() === ''+i)
                        continue loop;
                }
            }
            return i;
        }
        return -1;
    }
    findTextStreamById(id: string): DataStream {
        var name = this.getName();
        var streams = this.getStreams();
        loop:
        for(var i = 0; i < Community.MAX_TEXT_STREAMS; i++) {
            for(var stream of streams) {
                if(stream.hasPath()) {
                    var path = stream.getPath();
                    if(path.getType() === DataPath.TYPE_TEXT &&
                       path.getUser() === name &&
                       path.getPath() === id)
                        return stream;
                }
            }
        }
        return null;
    }
    updateRoleCustomJSON(user: string, role: string): any {
        return ["setRole", {
		    "community": this.getName(),
		    "account": user, "role": role  
        }];
    }
    updateTitlesCustomJSON(user: string, titles: string[]): any {
        return ["setUserTitle", {
		    "community": this.getName(),
		    "account": user, "title": titles.join(",")
        }];
    }
    updateSettingsCustomJSON(settings: any): any {
        return ["updateProps", {
            "community": this.getName(),
		    "props": { "settings": settings } 
        }];
    }
    updateStreamsCustomJSON(): any {
        var settings = Utils.copy(this.getSettings());
        settings.streams = [];
        for(var stream of this.streams) 
            settings.streams.push(stream.toJSON());
        return this.updateSettingsCustomJSON(settings);
    }
    copy(): Community {
        var copy = new Community();
        copy.communityData = this.communityData;
        copy.streams = [];
        for(var stream of this.streams) 
            copy.streams.push(DataStream.fromJSON(stream.community, stream.toJSON()));
        return copy;
    }
    async listJoined(): Promise<string[][]> {
        if(this.joined != null) return await this.joined;
        var name = this.getName();
        this.joined = Utils.retrieveAll("bridge", "list_subscribers", 
            {community:name, last: null, limit: 100});
        return await this.joined;
    }
    setJoined(joined: string[][]) {
        this.joined = Promise.resolve(joined); 
    }
    async reload(reloadJoined: boolean = false): Promise<Community> {
        var name = this.getName();
        Utils.getCommunityDataCache().reload(name);
        var data = await Utils.getCommunityData(name);
        this.initialize(data);
        if(reloadJoined) this.joined = null;
        data.community = this;
        return this;
    }
    static defaultStreams(community: string): DataStream[] {
        return [
            DataStream.fromJSON(community, ["About", "/about"]),
            DataStream.fromJSON(community, ["Posts", "/created"]),
            DataStream.fromJSON(community, ["Text"]),
            DataStream.fromJSON(community, ["General", "0"])
        ];
    }
    static async load(communityUsername: string): Promise<Community> {
        if(!communityUsername.startsWith("hive-")) return null;
        var data = await Utils.getCommunityData(communityUsername);
        if(data === null) return null;
        if(data.community != null) return data.community;
        var community = new Community();
        community.initialize(data);
        data.community = community;
        return community;
    } 
    static roleToIndex(role: string): number {
        if(role) switch(role) {
            case "owner": return 7;
            case "admin": return 6;
            case "mod": return 5;
            case "member": return 4;
            case "guest": return 3;
            //case "joined": return 2;
            //case "onboard": return 1;
            case "": return 0;
        }
        return -1;
    }
    toJSON() {
        var copy = {};
        var data = this.communityData;
        for(var item in data) {
            if(item === 'community') continue;
            copy[item] = data[item];
        }       
        return copy;
    }   
}
