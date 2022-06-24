import { NestFactory } from '@nestjs/core';
import { FrontendModule } from './frontend.module';

async function bootstrap() {
  const app = await NestFactory.create(FrontendModule);
  await app.listen(3000);
}
bootstrap();
