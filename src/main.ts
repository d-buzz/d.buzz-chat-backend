import "reflect-metadata"
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppDataSource } from "./data-source"
import { UserMessage } from "./entity/UserMessage"
import { Message } from "./entity/Message"
import { join } from 'path';

global.dhive = "123";

async function bootstrap() {             
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
   
    app.useStaticAssets(join(__dirname, '..', 'client'));
    app.useStaticAssets(join(__dirname, '..', 'dist', 'web', 'bundle'));

    await app.listen(3000);
    console.log(`Application is running on: ${await app.getUrl()}`);
}

AppDataSource.initialize().then(async () => {

    console.log("Inserting a new message into the database...")
    const message = new Message()
    message.conversation = "hive-1111111/0"
	message.timestamp = new Date() //.getTime()
	message.username = "mi"
	message.json = '["text", "hi"]'
	message.keytype = "p"
	message.signature = Buffer.from('12ff23eeaa', 'hex')
    //message.signature.toString('hex')

    await AppDataSource.manager.save(message)
    console.log("Saved a new message with id: " + message.id)

    console.log("Loading message from the database...")
    const messages = await AppDataSource.manager.find(Message)
    console.log("Loaded messages: ", messages.length, messages[messages.length-1])

    console.log("Starting setup.")
    await bootstrap();
}).catch(error => console.log(error))
