import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  constructor(private readonly configService: ConfigService) {}
  async transcribe(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      const hfToken = this.configService.getOrThrow<string>('HF_TOKEN');
      const hf = new InferenceClient(hfToken);
      this.logger.log(`Starting transcription with MIME type: ${mimeType}`);
      const audioBlob = new Blob([new Uint8Array(buffer)], {
        type: mimeType,
      });

      const result = await hf.automaticSpeechRecognition({
        model: 'openai/whisper-large-v3',
        data: audioBlob,
      });
      const transcript = result.text;
      if (!transcript || typeof transcript !== 'string') {
        throw new Error('Invalid transcription response');
      }
      this.logger.log('Transcription completed successfully');
      return transcript;
    } catch (error) {
      this.logger.error(
        'Transcription error:',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to transcribe audio');
    }
  }
}
