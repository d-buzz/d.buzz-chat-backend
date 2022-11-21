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
const NETNAME = process.env.NETNAME || 'main';
const NODES = (process.env.NODES || '').trim().split(";");

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
    name: NETNAME,
    host: BASE_URL+':'+PORT,
    account: ACCOUNT,
    localPort: PORT,
    nodes: NODES
}

export var NodeMethods = {
    canCreateGuestAccount: function() {
        //todo add check for account
        return POSTING_KEY != null;
    },
    createGuestAccount: function(msg) {
        if(POSTING_KEY == null) return null;
        var message = SignableMessage.create(NodeSetup.account, 
            msg.getUser(), msg.getJSONString(), SignableMessage.TYPE_ACCOUNT); 
        message.signWithKey(POSTING_KEY, 'p');
        return message;
    }
}


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



