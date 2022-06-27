import "reflect-metadata"
import { DataSource } from "typeorm"
import { Message } from "./entity/Message"
import { Preference } from "./entity/Preference"
import { UserMessage } from "./entity/UserMessage"

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
