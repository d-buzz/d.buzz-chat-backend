import { Module } from '@nestjs/common';
import { NetModule } from './net/net.module';
import { StlibModule } from './stlib/stlib.module';
//import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';

@Module({
  imports: [NetModule,StlibModule],
  controllers: [/*AppController*/],
  providers: [AppService],
})
export class AppModule {}
