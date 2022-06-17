import { Module } from '@nestjs/common';

import { DBColumn } from './DBColumn';

@Module({
    exports: [DBColumn]
})
export class UtilsModule {}

export { DBColumn }
