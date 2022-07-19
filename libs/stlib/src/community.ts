import { DataStream } from './data-stream'
import { Utils } from './utils'

export class Community {
    communityData: any
    streams: DataStream[]    

    getName() { return this.communityData.name; }
    getTitle() { return this.communityData.title; }
    getAbout() { return this.communityData.about; }
    getDescription() { return this.communityData.description; }
    getRules() { return this.communityData.flag_text; }
    getSettings() { return this.communityData.settings; }
    getStreams(): DataStream[] { return this.streams; }
    setStreams(streams: DataStream[]): void { this.streams = streams;}
    addStream(stream: DataStream): void { this.streams.push(stream);}

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
        return this.updateSettingsCustomJSON(settings.streams);
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
