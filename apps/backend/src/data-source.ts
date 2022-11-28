import "reflect-metadata"
import { DataSource } from "typeorm"
import { Message } from "./entity/Message"
import { Preference } from "./entity/Preference"
import { UserMessage } from "./entity/UserMessage"
import { SignableMessage, Utils } from '@app/stlib'

const BASE_URL = process.env.BASE_URL || 'http://localhost'
const PORT = process.env.PORT || 3000;
const DATABASE = process.env.DATABASE_URL || `postgres://postgres:test1234567@localhost:5432/test`;
const ACCOUNT = process.env.ACCOUNT || '';
const POSTING_KEY = process.env.POSTING_KEY || null;
const NETWORK_NAME = process.env.NETWORK_NAME || process.env.NETNAME || 'main';
const NODES = (process.env.NODES || '').trim().split(";");
const GUEST_ACCOUNT = process.env.GUEST_ACCOUNT || ACCOUNT;
const GUEST_POSTING_KEY = process.env.GUEST_POSTING_KEY || POSTING_KEY;

const DB_TYPE = process.env.DB_TYPE || "postgres";
export const AppDataSource = (DB_TYPE === "sqlite")?
new DataSource({
     type: "sqlite",
     database: DATABASE,
     synchronize: true,
     logging: false,
     entities: [Message, Preference, UserMessage],
     migrations: [],
     subscribers: []
}) 
:new DataSource({
    type: "postgres",
    url: DATABASE,
    synchronize: true,
    logging: false,
    entities: [Message, Preference, UserMessage],
    migrations: [],
    subscribers: [],
    ssl: {
        rejectUnauthorized: false
    }
});
export var NodeSetup = { 
    name: NETWORK_NAME,
    host: BASE_URL+':'+PORT,
    account: ACCOUNT,
    localPort: PORT,
    nodes: NODES
}
console.log("NodeSetup", NodeSetup);

export var NodeMethods = {
    canCreateGuestAccount: function(): boolean {
        //todo add check for account
        return GUEST_POSTING_KEY != null;
    },
    createGuestAccount: function(msg): SignableMessage {
        if(GUEST_POSTING_KEY == null) return null;
        var message = SignableMessage.create(GUEST_ACCOUNT, 
            msg.getUser(), msg.getJSONString(), SignableMessage.TYPE_ACCOUNT); 
        message.signWithKey(GUEST_POSTING_KEY, GUEST_ACCOUNT.length>0?'p':'@');
        return message;
    },
    verifyAccountCreateSignature: async function(msg): Promise<boolean> {
        return await msg.verify();
    }
}
Utils.setNetworkname(NodeSetup.name);

/*export var NodeSetup = {
    name: 'main',
    host: 'http://localhost:'+PORT,
    account: '',
    localPort: PORT,
    nodes: []
}*/
/**/

/*export var NodeSetup = createTestSetup();
function createTestSetup() {
    var setup = {
        name: 'main',
        host: BASE_URL+':'+PORT,
        account: '',
        localPort: PORT,
        nodes: []
    }
    for(var i = 0; i < 5; i++) {
        if(PORT !== 3000+i)
            setup.nodes.push(BASE_URL+':'+(3000+i));
    }
    return setup;
}*/



