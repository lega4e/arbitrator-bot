import 'module-alias/register';
import 'reflect-metadata';
import { makeBot } from '@/domain/di';

async function bootstrap() {
  const bot = await makeBot();
  await bot.launch();
}

bootstrap();
