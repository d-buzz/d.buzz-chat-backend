import "reflect-metadata"
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppDataSource, NodeSetup } from "./data-source"
import { join } from 'path';

global.dhive = require("@hiveio/dhive");

async function bootstrap() {     
    var env = process.env.NODE_ENV || "none";
    var isProductionEnv = env.startsWith("prod");

    console.log("Starting setup. Production: " + isProductionEnv)
            
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
   
    /*if(!isProductionEnv) {
        app.useStaticAssets(join(__dirname, '..', '..', '..', 
            'apps', 'backend', 'src', 'test', 'client'));
        app.useStaticAssets(join(__dirname, '..', '..', '..', 'dist', 'web', 'bundle'));
    }*/

    app.enableCors();

    await app.listen(NodeSetup.localPort);
    console.log(`Application is running on: ${await app.getUrl()}`);
}

AppDataSource.initialize().then(async () => {
    await bootstrap();
}).catch(error => console.log(error))
