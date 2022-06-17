import { Module } from '@nestjs/common';

import { NetGateway } from './net.gateway';

@Module({
  imports: [],
  providers: [NetGateway],
})
export class NetModule {}
