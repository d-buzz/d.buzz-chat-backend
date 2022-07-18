import { Module } from '@nestjs/common';
import { NetModule } from './net/net.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [NetModule, ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    })],
  controllers: [AppController],
  providers: [AppService, {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    }],
})
export class AppModule {}
