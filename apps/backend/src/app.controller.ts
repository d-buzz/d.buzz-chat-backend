import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { NetMethods } from "./net/net.module"
import { SignableMessage, Utils } from '@app/stlib'

@Controller('api')
export class AppController {
    constructor() {}

    @Get('readUserConversations/:username')
    @Post('readUserConversations/:username')
    async readUserConversations(@Param('username') username: string): Promise<any[]>{
        return await NetMethods.readUserConversations(username);
    }
   
    @Post('read')
    async readPost(@Body() message: any): Promise<any[]>{
        if(!Array.isArray(message) || message.length != 3) 
            return [false, 'enter json array ["conversation", fromTimestamp, toTimestamp]'];
        return await NetMethods.read(["r", ...message]);
    }

    @Get('readPreferences/:username')
    async readPreferences(@Param('username') username: string): Promise<any[]>{
        return await NetMethods.readPreferences(username);
    }
    @Post('readPreferences')
    async readPreferencesPost(@Body() message: any): Promise<any[]>{
        if(!Array.isArray(message) && message.length != 1) 
            return [false, 'enter string ["username"]'];
        return await NetMethods.readPreferences(message[0]);
    }

    @Post('write')
    async writePost(@Body() message: any): Promise<any[]>{
        if(!Array.isArray(message) || message.length != 7) 
            return [false, 'enter signable message json array ["w", "conversation", ...]'];
        return await NetMethods.write(message);
    }

    @Get('info') 
    @Post('info')
    async getInfo(): Promise<any[]> {
        return await NetMethods.info();
    }

    @Get('stats') 
    @Post('stats')
    getStats(): any[] {
        return NetMethods.stats();
    }

    @Get('version')
    getVersion(): any {
        return [true, Utils.getVersion()];
    }
    @Post('version')
    getVersionPost(): any {
        return [true, Utils.getVersion()];
    }
    
}
