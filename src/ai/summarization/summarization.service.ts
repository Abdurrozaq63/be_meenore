import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { SummaryResult } from './types/summary.type';

const summarySchema = z.object({
  themes: z.array(
    z.object({
      title: z.string().min(1),
      points: z.array(z.string().min(1)),
    }),
  ),
});

@Injectable()
export class SummarizationService {
  private readonly logger = new Logger(SummarizationService.name);
  private readonly ai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });
  }

  /**
   * Helper function untuk melakukan retry saat menemui error transient (503/429)
   */
  private async generateWithRetry(
    modelName: string,
    prompt: string,
    jsonSchema: any,
    maxRetries = 3,
  ) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
          },
        });
      } catch (error: any) {
        // Cek apakah error merupakan masalah sementara (503 High Demand / 429 Rate Limit)
        const isTransientError = error?.status === 503 || error?.status === 429;

        if (isTransientError && attempt < maxRetries) {
          const delayMs = attempt * 2000; // Delay bertahap: 2s, lalu 4s
          this.logger.warn(
            `Gemini API status ${error.status} on model ${modelName}. Retrying attempt ${attempt}/${maxRetries} in ${delayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // Jika bukan error transient atau batas retry habis, throw error ke penampung utama
        throw error;
      }
    }
  }

  async summarize(transcript: string): Promise<SummaryResult> {
    const prompt = `
You are an AI assistant for an audio summarization application.

Analyze the following transcript and organize the important information into several meaningful themes.

For each theme:
- Give it a concise title.
- Extract the important points.
- Do not invent information that is not present in the transcript.
- Keep the points concise but informative.
- Use the same language as the transcript.

Transcript:

${transcript}
    `;

    const jsonSchema = {
      type: 'object',
      properties: {
        themes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              points: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['title', 'points'],
          },
        },
      },
      required: ['themes'],
    };

    try {
      let response;

      // 1. Coba panggil Primary Model dengan Retry Logic
      try {
        response = await this.generateWithRetry(
          'gemini-2.5-flash',
          prompt,
          jsonSchema,
          3,
        );
      } catch (primaryError) {
        // 2. Jika Primary Model tetap gagal setelah retry, panggil Fallback Model (misal: gemini-2.5-flash-lite)
        this.logger.warn(
          'Primary Gemini model failed after retries. Attempting fallback model...',
        );
        response = await this.generateWithRetry(
          'gemini-3.5-flash-lite',
          prompt,
          jsonSchema,
          3,
        );
      }

      const text = response?.text;

      if (!text) {
        throw new Error('Gemini returned an empty response');
      }

      const parsed = JSON.parse(text);

      return summarySchema.parse(parsed);
    } catch (error: any) {
      this.logger.error('Summarization error:', error);

      throw new InternalServerErrorException(
        'Failed to summarize transcript due to temporary AI service overload. Please try again.',
      );
    }
  }
}
