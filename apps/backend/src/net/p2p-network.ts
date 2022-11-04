import axios from 'axios'
import { SignableMessage, Utils } from '@app/stlib'
import { NodeSetup } from "../data-source"
import { io } from 'socket.io-client';

const CHECK_NODES_EVERY_MS = 5000;
var MIN_CONNECTED_NODES = 2;
var MAX_CONNECTED_NODES = 5;
var lastCheck = 0;
var connectTimer = null;
export class P2PNetwork {
    static online: NodeInfo[] = []
    static offline: NodeInfo[] = []
    static connected: {[key: string]: NodeInfo} = {}  

    static startConnectTimer() {
        if(connectTimer == null)
            connectTimer = setInterval(P2PNetwork.connectIfNeeded, 10000);
    }
    static findConnectNodeInfoByUrl(url: string): NodeInfo {
        var result = P2PNetwork.connected[url];
        return result?result:null;
    }
    static async connectNodeInfo(info: NodeInfo): Promise<boolean> { 
        var found = P2PNetwork.findConnectNodeInfoByUrl(info.url);
        if(found == null) {
            P2PNetwork.connected[info.url] = info;
            var result = await info.connect();
            if(result) return true;
            delete P2PNetwork.connected[info.url];
        }
        else if(found === info && info.canConnect()) {
            var result = await info.connect();
            if(result) return true;
            delete P2PNetwork.connected[info.url];
        }
        return false;
    }
    static clearDisconnectedNodes() {
        for(var url in P2PNetwork.connected) {
            var info = P2PNetwork.connected[url];
            if(!info.connecting && !info.isConnected())
                delete P2PNetwork.connected[url];
        }
    }
    static async connectIfNeeded(): Promise<boolean> {
        var ti = Utils.utcTime();
        if(ti-lastCheck < 5000) return true;
        lastCheck = ti;
        P2PNetwork.clearDisconnectedNodes();
        if(Object.keys(P2PNetwork.connected).length >= MIN_CONNECTED_NODES) return true;
        P2PNetwork.connectNode();    
        return true;
    }
    static async connectNode(): Promise<boolean> {
        for(var info of P2PNetwork.online) {
            if(P2PNetwork.findConnectNodeInfoByUrl(info.url) === null && info.canConnect()) 
                return await P2PNetwork.connectNodeInfo(info);
        }   
        return false;
    }

    static async loadNodes(urls: any[]): Promise<number> {
        var checkedUrls = {};
        var toCheck = [...urls];

        while(toCheck.length > 0) {
            var url = toCheck.pop();
            if(checkedUrls[url]) continue;
            checkedUrls[url] = true;

            var nodeInfo = new NodeInfo(url);
            var info = nodeInfo.getInfoURL();
            try {
                var response = await axios.get(info);
                if(response.status === 200) {
                    var data = response.data;
                    console.log(data);
                    if(!data[0] || data[1].name !== NodeSetup.name) {
                        throw "network mismatch " + info + " "
                            + data[1].name + " != " + NodeSetup.name;
                    }
                    nodeInfo.setData(data[1]);
                    for(var nodeUrl of nodeInfo.getNodes())
                        if(!checkedUrls[nodeUrl])
                           toCheck.push(nodeUrl); 
                    P2PNetwork.online.push(nodeInfo);
                }
                else throw "status " + response.status;
            }
            catch(e) {
                console.log("failed to connect to " + info + ", " + e);
                P2PNetwork.offline.push(nodeInfo);
            }
        }
        
        return P2PNetwork.online.length;
    }
    
    /*static onLine(): boolean {
        return true;
    }*/
    /*static async write(msg: SignableMessage): Promise<boolean> {
        for(var node of P2PNetwork.connected) {
            
        }
    }*/
}


export class NodeInfo {
    url: string 
    data: any
    socket: any
    connecting: boolean = false
    connectAttemptTimestamp: number = 0
    constructor(url) {
        this.url = url;
        this.data = null;
    }
    getInfoURL() { return this.url+'/api/info';}
    setData(data: any) {
        this.data = data;
    }
    getNodes() {
        if(this.data == null) return [];
        if(this.data.nodes == null || !Array.isArray(this.data.nodes)) 
            return [];
        return this.data.nodes;
    }
    async read(url: string): Promise<any> {
        return await axios.get(url);
    }
    canConnect(): boolean {
        var timestamp = Utils.utcTime();
        return Math.abs(this.connectAttemptTimestamp-timestamp) >= 30*60*1000;
    }
    async connect() {
        var timestamp = Utils.utcTime();
        if(Math.abs(this.connectAttemptTimestamp-timestamp) < 30*60*1000) return false;
        console.log("attempting to connect to node: ", this.url);
        try {
            this.connecting = true;
            this.connectAttemptTimestamp = timestamp;
            var socket = io(this.url, {
                transports:["websocket", "polling"]                    
            });
            socket.on("connect_error", (err) => {
                console.log(`connect_error ${err.message}`);
                socket.disconnect();
            });
            socket.on('disconnect', function() {
                console.log("disconnected ");
            });
            var result = await this.emit('i', "", socket);
            console.log("result", result);
            if(result[0]) {
                this.socket = socket;
                return true;
            }
        }
        finally {
            this.connecting = false;
        }
        return false;
    }
    isConnected() {
        var socket = this.socket;
        return socket != null && socket.connected;
    }
    async readPreferences(from: number, lastUser: string, limit: number): Promise<any[]> {
        return await this.emit("r", ["r", "@", from, lastUser, limit]);
    }
    async readMessages(from: number, lastId: number, limit: number): Promise<any[]> {
        return await this.emit("rm", ["rm", from, lastId, limit]);
    }
    emit(type: any, data:any, socket: any = this.socket): Promise<any[]> {
        return new Promise<any[]>((resolve,error)=>{
            try {
                socket.emit(type, data, (data)=>{
                    resolve(data);
                });
            } catch(e) { error(e); }
        });
    }
    disconnect() {
        var socket = this.socket;
        if(socket != null) {
            try {
                socket.close();
            }
            catch(e) { console.log(e); }
            finally {
                this.socket = null;
            }
        }
    }
}





