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

    @Get('readPreference/:username')
    async readPreference(@Param('username') username: string): Promise<any[]>{
        return await NetMethods.readPreference(username);
    }
    @Post('readPreference')
    async readPreferencePost(@Body() message: any): Promise<any[]>{
        if(!Array.isArray(message) && message.length != 1) 
            return [false, 'enter string ["username"]'];
        return await NetMethods.readPreference(message[0]);
    }

    @Get('readPreferences/:from/:to')
    async readPreferences(@Param('from') from: string, @Param('to') to: string): Promise<any[]> {
        return await NetMethods.readPreferences(new Number(from), new Number(to));
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

    @Get('testsync') 
    @Post('testsync')
    async testsync(): Promise<any[]> {
        return await NetMethods.sync();
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
