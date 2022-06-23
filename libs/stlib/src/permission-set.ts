type HiveRole = "Owner"|"Admin"|"Mod"|"Member"|"Guest"|"";
type StreamRole = HiveRole|"Joined"|"Onboard";

export class PermissionSet {
    role: StreamRole
    titles: string[]

    constructor() {
        this.role = "";
        this.titles = [];
    }
    
    hasTitle(title: string): boolean { 
        return this.titles.indexOf(title) != -1;
    }
    setRole(role: StreamRole) { this.role = role; }
    addTitle(title: string) { 
        if(this.hasTitle(title)) return;
        this.titles.push(title);
    }
    getHiveRole(): HiveRole {
        if(this.role == "" || this.role == "Onboard" || this.role == "Joined") return "";
        return this.role;
    }
    getStreamRole(): StreamRole {
        return this.role || "";
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
