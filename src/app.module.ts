import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { UserModule } from './user/user.module';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';

import { TagsModule } from './tags/tags.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { AudioModule } from './audio/audio.module';
import { AiModule } from './ai/ai.module';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        UPLOADTHING_TOKEN: Joi.string().required(),
        GEMINI_API_KEY: Joi.string().required(),
        HF_TOKEN: Joi.string().required(),
      }),
    }),
    UsersModule,
    DatabaseModule,
    TagsModule,
    AuthModule,
    TagsModule,
    SessionsModule,
    AudioModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
