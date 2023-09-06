import { Module } from '@nestjs/common';
import { DBColumn } from './DBColumn';
import { MessageStats } from './message-stats';
import { MessageNotifications } from './message-notifications';
import { Upvotes } from './upvotes';

@Module({
    exports: [DBColumn, MessageStats, MessageNotifications, Upvotes]
})
export class UtilsModule {}
export { DBColumn, MessageStats, MessageNotifications, Upvotes }
