import { Content, Utils } from '@app/stlib'

const MAX_NOTIFICATIONS_PER_USER = 500;

export class MessageNotifications {
    users: any = {}
    lastUser: any = {}
    read(user: string, create: boolean = false) {
        var arr = this.users[user];
        if(arr) return arr;
        arr = [];
        if(create) this.users[user] = arr;
        return arr;
    }
    notify(user: string, obj: any) {
        var data = this.read(user, true);
        var index = 0;
        while(index < data.length && obj.date < data[index].date) index++;
        if(index === 0) data.unshift(obj);
        else data.splice(index, 0, obj); 
        if(data.length > MAX_NOTIFICATIONS_PER_USER)
            data.length = MAX_NOTIFICATIONS_PER_USER;
    }
    add(user: string, conversation: string, json: string, timestamp: number) {
        try {
            var mentions = null;
            var i = user.indexOf('&');
            if(i !== -1) {
                mentions = user.substring(i+1).split('&');
                user = user.substring(0, i);
            }
            if(Utils.isJoinableGroupConversation(conversation)) {
                //to all users in this group
            }
            else if(Utils.isGroupConversation(conversation)) {
                var users = Utils.getGroupUsernames(conversation);
                for(var notifyUser of users) {
                    if(notifyUser === user) continue;
                    let url = '/p';
                    for(var user0 of users) {
                        if(user0 === notifyUser) continue;
                        url += '/'+user0;
                    }
                    this.notify(notifyUser, {
                     type: 'direct', 
                     date: new Date(timestamp).toISOString(),
                     msg: `direct message from @${user}`,
                     url: url
                    });
                }
            }
            else if(Utils.isCommunityConversation(conversation)) {
                var conversationParts = Utils.parseConversation(conversation);
                var communityName = conversationParts[0];
                var communityPath = conversationParts[1];
                if(Utils.isValidGuestName(communityName) && /[a-zA-Z0-9-_]+/.test(communityPath)) {
                    var url = `/t/${communityName}/${communityPath}?j=${user}|${timestamp}`;
                    if(mentions !== null) {
                        for(var notifyUser0 of mentions) {
                            if(notifyUser0 === user) continue;
                            this.notify(notifyUser0, {
                             type: 'mention', 
                             date: new Date(timestamp).toISOString(),
                             msg: `mention from @${user}`,
                             url: url
                            });
                        }
                    }
                    if(json.startsWith("[\"e\"")) {
                        var content = JSON.parse(json);
                        if(content.length > 2 && typeof content[1] === 'string' 
                            && typeof content[2] === 'string' 
                            && (i=content[2].indexOf('|')) !== -1) {
                            var messageUser = content[2].substring(0, i);
                            var messageTimestamp = Number(content[2].substring(i+1));
                            //if message exists, notify messageUser
                            if(messageUser !== user) {
                                var text = content[1].length < 7?`with ${content[1]}`:'to message';
                                this.notify(messageUser, {
                                 type: 'response', 
                                 date: new Date(timestamp).toISOString(),
                                 msg: `@${messageUser} responded ${text}`,
                                 url: url
                                });
                            }
                        }
                    }
                    else if(json.startsWith("[\"t\"") || json.startsWith("[\"i\"") ||
                        json.startsWith("[\"q\"") || json.startsWith("[\"h\"")) {
                        var lastUser = this.lastUser[conversation];
                        if(lastUser != null && lastUser !== user) {
                            this.notify(lastUser, {
                             type: 'continuation', 
                             date: new Date(timestamp).toISOString(),
                             msg: `@${user} continued the conversation ${conversation}`,
                             url: url
                            });  
                        }
                        this.lastUser[conversation] = user;
                    }
                }
            }
        }
        catch(e) { }
    }
}
