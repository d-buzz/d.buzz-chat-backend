import { DataStream } from './data-stream'
import { DataPath } from './data-path'
import { Utils } from './utils'

export class Community {
    static readonly MAX_TEXT_STREAMS: number = 64;

    communityData: any
    streams: DataStream[] 

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

    newCategory(name: string): DataStream { 
        var category = DataStream.fromJSON(this.getName(), [name]);
        this.addStream(category);
        return category;
    }
    newTextStream(name: string): DataStream {
        var groupId = this.findFreeTextStreamId();
        if(groupId === -1) throw "maximum limit of " + Community.MAX_TEXT_STREAMS + " text streams reached";
        var stream = DataStream.fromJSON(this.getName(), [name, ''+groupId]);
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

    

    /*canUpdateSettings(user: string): boolean {
        return true;
    }*/

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
}
