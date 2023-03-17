/*
Store number of daily messages for stat purposes
and displaying active communities.
*/
export class MessageStats {
    days: number
    data: any = []
    maxDay: number = -1

    lastTime: any = {}
    lastTimeWildcards: any = {}
    constructor(days: number) {
        this.days = days;
    }
    add(key: string, time: number) {
        var data = this.bin(time);
        var number = data[key];
        if(number === undefined) data[key] = 1;
        else data[key] = number+1;
    }
    updateLast(key: string, time: number) {
        var last = this.lastTime[key];
        if(last === undefined) { 
            last = time;
            var i = key.indexOf('/'); 
            if(i !== -1) {
                var keyG = key.substring(0, i+1)+'*'; 
                var map = this.lastTimeWildcards[keyG];
                if(map === undefined) this.lastTimeWildcards[keyG] = map = {};
                map[key] = true;
            }
        }
        this.lastTime[key] = Math.max(time, last);
    }
    bin(time: number) {
        var day = MessageStats.day(time);
        if(day > this.maxDay) {
            if(this.data.length >= this.days) this.data.splice(0, day-this.maxDay);
            var result = {};
            while(this.data.length < this.days) this.data.push(result={});
            this.maxDay = day;
            return result;
        }
        else {
            var index = this.data.length-1-(this.maxDay-day);
            if(index >= 0) return this.data[index];
        }
        return null;
    }
    readLast(keys: string[]): any {
        var result = {};  
        if(keys != null)
            for(var key of keys) {
                var last = this.lastTime[key];
                if(last !== undefined) result[key] = last;
                if(key.endsWith("/*")) {
                    var map = this.lastTimeWildcards[key];
                    if(map !== undefined) {
                        for(var key2 in map) {
                            var last2 = this.lastTime[key2];
                            if(last2 !== undefined) result[key2] = last2;
                        }
                    }
                }
            }
        return result;
    }
    static day(time: number) {
        return (time-Math.floor(time%86400000))/86400000;
    }

}
