import { CacheModule, Module } from '@nestjs/common';
import { NetGateway } from './net.gateway';
import { NetMethods } from "./net-methods"
import { Database } from './database';

@Module({
  imports: [CacheModule.register(),Database,NetMethods],
  providers: [NetGateway],
  exports: [Database,NetMethods]
})
export class NetModule {}
export {Database, NetMethods}
