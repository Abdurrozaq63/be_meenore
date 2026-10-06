import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { StorageService } from './storage/storage.service';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [AudioController],
  providers: [AudioService, StorageService],
  exports: [StorageService],
})
export class AudioModule {}
