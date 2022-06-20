import { Module } from '@nestjs/common';
import { SignableMessage } from './signable-message';

@Module({
    imports: [SignableMessage],
    exports: [SignableMessage]
})
export class StlibModule {}
export { SignableMessage }
