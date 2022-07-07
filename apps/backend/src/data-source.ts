import "reflect-metadata"
import { DataSource } from "typeorm"
import { Message } from "./entity/Message"
import { Preference } from "./entity/Preference"
import { UserMessage } from "./entity/UserMessage"

const PORT = process.env.PORT || 3000;

//const DBTYPE = process.env.PORT || "postgres";
export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "test1234567",
    database: "test",
    synchronize: true,
    logging: false,
    entities: [Message, Preference, UserMessage],
    migrations: [],
    subscribers: [],
})
/*export const AppDataSource = new DataSource({
     type: "sqlite",
     database: `:memory:`,

     entities: [Message, Preference, UserMessage],
     migrations: [],
     subscribers: [],
})*/

/*export var NodeSetup = {
    name: 'main',
    host: 'http://localhost:'+PORT,
    account: '',
    localPort: PORT,
    nodes: []
}*/
export var NodeSetup = createTestSetup();



function createTestSetup() {
    var setup = {
        name: 'main',
        host: 'http://localhost:'+PORT,
        account: '',
        localPort: PORT,
        nodes: []
    }
    for(var i = 0; i < 5; i++) {
        if(PORT !== 3000+i) 
            setup.nodes.push('http://localhost:'+(3000+i));
    }
    return setup;
}



