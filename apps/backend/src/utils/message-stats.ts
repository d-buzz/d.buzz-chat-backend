/*
Store number of daily messages for stat purposes
and displaying active communities.
*/
export class MessageStats {
    days: number
    data: any = []
    maxDay: number = -1
    constructor(days: number) {
        this.days = days;
    }
    add(key: string, time: number) {
        var data = this.bin(time);
        var number = data[key];
        if(number === undefined) data[key] = 1;
        else data[key] = number+1;
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
    static day(time: number) {
        return (time-Math.floor(time%86400000))/86400000;
    }
}
