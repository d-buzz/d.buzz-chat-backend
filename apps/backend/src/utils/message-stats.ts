/*
Store number of daily messages for stat purposes
and displaying active communities.
*/
export class MessageStats {
    days: number
    data: any = []
    maxDay: number = -1

    lastTime: any = {}
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
        if(last === undefined) last = time;
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
    readLast(keys: string[]): any { console.log("keys ", keys);
        var result = {};  
        if(keys != null)
            for(var key of keys) {
                var last = this.lastTime[key];
                if(last !== undefined) result[key] = last;
            }
        return result;
    }
    static day(time: number) {
        return (time-Math.floor(time%86400000))/86400000;
    }

}
