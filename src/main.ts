import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PostgresExceptionFilter } from './common/filters/postgres-exception.filter';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PostgresExceptionFilter());
  app.enableCors({
    origin: 'https://meenore.vercel.app/', // Mengizinkan frontend React Anda
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Izinkan jika nanti butuh mengirim cookie/session
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
