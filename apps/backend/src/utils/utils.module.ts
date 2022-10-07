import { Module } from '@nestjs/common';
import { DBColumn } from './DBColumn';
import { MessageStats } from './message-stats';

@Module({
    exports: [DBColumn, MessageStats]
})
export class UtilsModule {}
export { DBColumn, MessageStats }
