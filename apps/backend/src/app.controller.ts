import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { NetMethods } from "./net/net.module"
import { SignableMessage, Utils } from '@app/stlib'

@Controller('api')
export class AppController {
    constructor() {}

    @Get('availableAccount/:username')
    async availableAccount(@Param('username') username: string): Promise<any[]>{
        return await NetMethods.availableAccount(username);
    }

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

    @Get('readPreferences/:from')
    async readPreferences0(@Param('from') from: string): Promise<any[]> {
        return await NetMethods.readPreferences(new Number(from) as number, null, 100);
    }
    @Get('readPreferences/:from/:user')
    async readPreferences1(@Param('from') from: string, @Param('user') user: string): Promise<any[]> {
        return await NetMethods.readPreferences(new Number(from) as number, user, 100);
    }
    @Get('readPreferences/:from/:user/:limit')
    async readPreferences(@Param('from') from: string, @Param('user') user: string,
            @Param('limit') limit: string): Promise<any[]> {
        return await NetMethods.readPreferences(new Number(from) as number,
                 user, new Number(limit) as number);
    }

    @Get('readMessages/:from')
    async readMessages0(@Param('from') from: string): Promise<any[]> {
        return await NetMethods.readMessages(new Number(from) as number, 0, 100);
    }
    @Get('readMessages/:from/:lastid')
    async readMessages1(@Param('from') from: string, @Param('lastid') lastid: string): Promise<any[]> {
        return await NetMethods.readMessages(new Number(from) as number, new Number(lastid) as number, 100);
    }
    @Get('readMessages/:from/:lastid/:limit')
    async readMessages(@Param('from') from: string, @Param('lastid') lastid: string,
            @Param('limit') limit: string): Promise<any[]> {
        return await NetMethods.readMessages(new Number(from) as number,
                 new Number(lastid) as number, new Number(limit) as number);
    }
    @Get('readNotifications/:from')
    async readNotifications(@Param('from') from: string): Promise<any[]> {
        return await NetMethods.readNotifications(from);
    }
    @Get('readNotificationCount/:from')
    async readNotificationCount(@Param('from') from: string): Promise<any[]> {
        return await NetMethods.readNotificationCount(from);
    }

    @Post('account')
    async account(@Body() message: any): Promise<any[]>{
        if(!Array.isArray(message) || message.length != 4) 
            return [false, 'enter signable message json array ["a", "user", "user", "newPublicPostingKey"]'];
        return await NetMethods.account(message);
    }

    @Post('write')
    async writePost(@Body() message: any): Promise<any[]>{
        if(!Array.isArray(message) || message.length != 7) 
            return [false, 'enter signable message json array ["w", "user", "conversation", ...]'];
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
