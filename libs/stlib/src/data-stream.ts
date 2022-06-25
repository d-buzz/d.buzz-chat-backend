import { PermissionSet } from './permission-set'
import { DataPath } from './data-path'

export class DataStream {
    community: string
    dataPath: DataPath
    name: string
    readSet: PermissionSet
    writeSet: PermissionSet

    constructor(community: string) {
        this.community = community;
    }
    hasPath(): boolean { return this.dataPath != null;}
    getPath(): DataPath { return this.dataPath; }
    getPathType(): string {
        if(this.hasPath()) return this.getPath().getType();
        return null;
    }
    getName(): string { return this.name; }
    getReadPermissions(): PermissionSet { return this.readSet; }
    getWritePermissions(): PermissionSet { return this.writeSet; }

    getCompactPath(): string {
        if(this.dataPath === null) return null;
        return this.dataPath.toString(this.community);
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
        var path = jsonArray[1] || null;
        var dataStream = new DataStream(community);
        dataStream.name = jsonArray[0];
        dataStream.dataPath = (path === null)?null:DataPath.fromString(path, community);
        dataStream.readSet = PermissionSet.fromJSON(jsonArray[2] || null);
        dataStream.writeSet = PermissionSet.fromJSON(jsonArray[3] || null);
        return dataStream;
    }
}




