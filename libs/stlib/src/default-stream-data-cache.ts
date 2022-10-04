import { Community } from './community'
import { StreamDataCache } from './stream-data-cache'
import { Utils } from './utils'

/*
Class used for retrieving up-to-date roles, titles of users in communities.
Data is loaded on request and real-time updates are handled by block streaming.
*/
export class DefaultStreamDataCache extends StreamDataCache {
    constructor() {
        super(Utils.getDhiveClient());
        var _this = this;
        this.forCustomJSON("community", async (user, json, posting)=>{
            console.log("community", user, json, posting);
            var type = json[0];
            switch(type) {
                case "setRole":
                    _this.onSetRole(user, json[1]);
                    break;
                case "setUserTitle":
                    _this.onSetTitle(user, json[1]);
                    break;
                case "updateProps":
                    _this.onUpdateProps(user, json[1]);
                    break;
            }
        });
    }
    async onSetRole(user: string, json: any) {
        var community = json.community;
        var account = json.account;
        var role = json.role;
        //validate role, check if can set
        var roleToSetIndex = Community.roleToIndex(role);
        if(roleToSetIndex === -1 && roleToSetIndex < 7) return;
        var data = await Community.load(community);
        if(!data) return;        
        if(data.canSetRole(user, role)) {
            console.log("update role ", community, account, role);
            data.setRole(account, role);
        } 
        else console.log("update role no permission", community, account, role);
    }
    async onSetTitle(user: string, json: any) {
        var community = json.community;
        var account = json.account;
        var title = json.title;
        //check if can set
        var data = await Community.load(community);
        if(!data) return;   
        if(data.canSetTitles(user)) {
            console.log("update title ", community, account, title);
            data.setTitles(account, title.split(","));  
        }
        else console.log("update title no permission", community, account, title); 
    }
    async onUpdateProps(user: string, json: any) {
        var community = json.community;
        var props = json.props;
        if(props) {
            var settings = props.settings;
            if(settings) {
                var streams = settings.streams;
                if(streams) {
                    
                }
            }
        }   
    }
    async getRole(community: string, user: string) {
        var data = await Community.load(community);
        if(!data) return null;
        return data.getRole(user);
    }
    async getTitles(community: string, user: string) {
        var data = await Community.load(community);
        if(!data) return null;
        return data.getTitles(user);
    }
    async getUser(community: string, user: string) {
        var result = await Community.load(community);
        if(!result) return null;
        return result.getRoleEntry(user);
    }
    async lookup(community: string, user: string = null) {
        var result = await Community.load(community);
        if(!result) return null;
        if(user !== null) result = result.getOrCreateRoleEntry(user);
        return result;    
    }
}




