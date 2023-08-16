import { Module } from '@nestjs/common';
import { DBColumn } from './DBColumn';
import { MessageStats } from './message-stats';
import { MessageNotifications } from './message-notifications';

@Module({
    exports: [DBColumn, MessageStats, MessageNotifications]
})
export class UtilsModule {}
export { DBColumn, MessageStats, MessageNotifications }
