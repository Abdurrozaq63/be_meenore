import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription/transcription.service';
import { SummarizationService } from './summarization/summarization.service';

@Module({
  providers: [TranscriptionService, SummarizationService],
  exports: [TranscriptionService, SummarizationService],
})
export class AiModule {}
