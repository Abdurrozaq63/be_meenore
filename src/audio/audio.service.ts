import { Injectable } from '@nestjs/common';
import { UploadAudio } from './types/uploaded-audio.type';
import { Multer } from 'multer';
import { StorageService } from './storage/storage.service';
import { TranscriptionService } from 'src/ai/transcription/transcription.service';
import { ProcessedAudio } from './types/processed-audio.type';
import { SummarizationService } from 'src/ai/summarization/summarization.service';

@Injectable()
export class AudioService {
  constructor(
    private readonly storageService: StorageService,
    private readonly transcriptionService: TranscriptionService,
    private readonly summarizationService: SummarizationService,
  ) {}

  async upload(file: Express.Multer.File): Promise<UploadAudio> {
    return this.storageService.upload(file);
  }

  async transcribe(file: Express.Multer.File): Promise<{ transcript: string }> {
    const transcript = await this.transcriptionService.transcribe(
      file.buffer,
      file.mimetype,
    );

    return {
      transcript,
    };
  }

  async process(file: Express.Multer.File): Promise<ProcessedAudio> {
    const uploadedAudio = await this.storageService.upload(file);

    const transcript = await this.transcriptionService.transcribe(
      file.buffer,
      file.mimetype,
    );

    return {
      ...uploadedAudio,
      transcript,
    };
  }

  async summarize(transcript: string) {
    return this.summarizationService.summarize(transcript);
  }
}
