import { AppDataSource } from "./data-source"
import { UserMessage } from "./entity/UserMessage"
import { Message } from "./entity/Message"

AppDataSource.initialize().then(async () => {

    console.log("Inserting a new message into the database...")
    const message = new Message()
    message.conversation = "hive-1111111/0"
	message.timestamp = 1234567
	message.username = "mi"
	message.json = '["text", "hi"]'
	message.keytype = "p"
	message.signature = "0123"

    await AppDataSource.manager.save(message)
    console.log("Saved a new message with id: " + message.id)

    console.log("Loading message from the database...")
    const messages = await AppDataSource.manager.find(Message)
    console.log("Loaded messages: ", messages)

    console.log("Starting setup.")

}).catch(error => console.log(error))
