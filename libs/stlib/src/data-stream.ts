import { PermissionSet } from './permission-set'

export class DataStream {
    community: string
    dataPath: string
    name: string
    readSet: PermissionSet
    writeSet: PermissionSet

    constructor(community: string) {
        this.community = community;
    }

    getPath() { return this.dataPath; }
    getName() { return this.name; }
    getReadPermissions(): PermissionSet { return this.readSet; }
    getWritePermissions(): PermissionSet { return this.writeSet; }

    getCompactPath(): string {
        if(this.dataPath === null) return null;
        return (this.dataPath.startsWith(this.community+'/'))
            ?this.dataPath.substring(this.community.length+1):this.dataPath;
    }
    toJSON(): any[] {
        var json = [this.getName()];
        var dataPath = this.getCompactPath();
        if(dataPath === null) return json;
        json.push(dataPath);
        json.push(this.readSet.toJSON());
        json.push(this.writeSet.toJSON());
        return json;
    }
    static fromJSON(community: string, jsonArray: any[]): DataStream {
        var dataStream = new DataStream(community);
        dataStream.name = jsonArray[0];
        dataStream.dataPath = jsonArray[1] || null;
        dataStream.readSet = PermissionSet.fromJSON(jsonArray[2] || null);
        dataStream.writeSet = PermissionSet.fromJSON(jsonArray[3] || null);
        return dataStream;
    }
}
