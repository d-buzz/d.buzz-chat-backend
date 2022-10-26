import axios from 'axios'
import { SignableMessage, Utils } from '@app/stlib'
import { NodeSetup } from "../data-source"

const CHECK_NODES_EVERY_MS = 5000;
var MIN_CONNECTED_NODES = 2;
var MAX_CONNECTED_NODES = 5;
var lastCheck = 0;
export class P2PNetwork {
    static online: NodeInfo[] = []
    static offline: NodeInfo[] = []
    static connected: NodeInfo[] = []  

    /*static async connectIfNeeded(): Promise<boolean> {
        var ti = Utils.utcTime();
        if(ti-lastCheck < 5000 &&
           P2PNetwork.connected.length >= MIN_CONNECTED_NODES) return true;
        lastCheck = ti;
        
                

        return true;
    }*/
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
                    if(!data[0] || data[1] !== NodeSetup.name) {
                        throw "network mismatch " + info + " "
                            + data[1] + " != " + NodeSetup.name;
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
}





