import { Utils } from '@app/stlib'

/*
Store existing upvote messages.
*/
export class Upvotes {
    days: number
    conversations: any = {}

    constructor(days: number) {
        this.days = days;
    }
    async load(container: string) {
        var posts = await Utils.getDhiveClient().database
                .getDiscussions("blog", {tag:container});
        Utils.delay(500);
        for(var post of posts) {
            var comments = await Utils.getDhiveClient().database
                .call('get_content_replies', [post.author, post.permlink]); 
            for(var comment of comments) {
                var parts = Utils.decodeUpvotePermlink(comment.permlink);
                if(parts !== null) {
                    parts.push(comment.author);
                    parts.push(comment.permlink);
                    parts.push(new Date(comment.created+"Z").getTime());
                    this.add(parts);
                }
            }
            Utils.delay(500)        
        }
    }
    add(parts: any) {
        var conversation = parts[1];
        var array = this.conversations[conversation];
        if(!array) this.conversations[conversation] = array = [parts];
        else array.push(parts);
    }
    readUpvotes(keys: string[]): any {
        var result = {};  
        if(keys != null)
            for(var key of keys) {
                var data = this.conversations[key];
                if(data !== undefined) result[key] = data;
                if(key.endsWith("/*")) {
                    key = key.substring(0,key.length-1);
                    for(var conversation in this.conversations) {
                        if(conversation.startsWith(key)) {
                            var data2 = this.conversations[conversation];
                            if(data2 !== undefined) result[conversation] = data2;
                        }
                    }
                }
            }
        return result;
    }
    deleteOldEntries() {
        var time = Utils.utcTime()-this.days*86400000;
        for(var conversation in this.conversations) {
            var array = this.conversations[conversation];
            for(var i = array.length-1; i >= 0; i--) 
                if(array[i][5] < time) { array.splice(i, 1); } 
            if(array.length === 0) delete this.conversations[conversation];
        }
    }
}
