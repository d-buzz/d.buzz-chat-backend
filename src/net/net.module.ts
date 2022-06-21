import { CacheModule, Module } from '@nestjs/common';

import { NetGateway } from './net.gateway';
import { Database } from './database';

@Module({
  imports: [CacheModule.register(),Database],
  providers: [NetGateway],
  exports: [Database]
})
export class NetModule {}
export {Database}
