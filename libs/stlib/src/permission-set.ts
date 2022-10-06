type HiveRole = "owner"|"admin"|"mod"|"member"|"guest"|"";
type StreamRole = HiveRole|"joined"|"onboard";

export class PermissionSet {
    role: StreamRole
    titles: string[]

    constructor() {
        this.role = "";
        this.titles = [];
    }
    validateRole(role: string): boolean { return PermissionSet.roleToIndex(this.role) <= PermissionSet.roleToIndex(role); }
    validateTitles(titles: string[]): boolean { 
        var arr = this.titles;
        var matches = true;
        for(var i = 0; i < arr.length; i++) {
            var item = arr[i];
            if(item === '|') {
                if(matches) return true;
                matches = true;
            }
            else if(matches && (!titles || titles.indexOf(item) === -1)) 
                matches = false;
        }
        return matches;
    }
    validate(role: string, titles: string[]) {
        return this.validateRole(role) && this.validateTitles(titles);
    }
    isEmpty(): boolean {
        return this.role === "" && this.titles.length === 0;
    }
    hasTitle(title: string): boolean { 
        return this.titles.indexOf(title) != -1;
    }
    setRole(role: StreamRole) { this.role = role; }
    addTitle(title: string) { 
        if(this.hasTitle(title)) return;
        this.titles.push(title);
    }
    delTitle(title: string): boolean {
        var i = this.titles.indexOf(title);
        if(i !== -1) this.titles.splice(i, 1);
        return i !== -1;
    }
    getHiveRole(): HiveRole {
        if(this.role == "" || this.role == "onboard" || this.role == "joined") return "";
        return this.role;
    }
    getStreamRole(): StreamRole {
        return this.role || "";
    }
    static roleToIndex(role: string): number {
        switch(role) {
            case "owner": return 7;
            case "admin": return 6;
            case "mod": return 5;
            case "member": return 4;
            case "guest": return 3;
            case "joined": return 2;
            case "onboard": return 1;
        }
        return 0;
    }
    toJSON(): any {
        var role = this.getStreamRole();
        var titles = this.titles;
        if((role === "") && titles.length === 0) return null;
        return [role, ...titles];
    }
    static fromJSON(json: any): PermissionSet {
        var set = new PermissionSet();
        if(json !== null && json.length > 0) {
            set.setRole(json[0]);
            for(var i = 1; i < json.length; i++) 
                set.addTitle(json[i]);
        }
        return set;
    }
}
