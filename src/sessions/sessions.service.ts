import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionsRepository } from './sessions.repository';
import { ThemesRepository } from './themes.repository';
import { ThemePointsRepository } from './theme-points.repository';
import { DatabaseService } from 'src/database/database.service';
import { CreateSessionData } from './types/create-session.type';
import { CreateThemeData } from './types/create-theme-data.type';
import { CreateThemePointData } from './types/create-theme-point-data.type';
import { CreateSessionInput } from './types/create-session-input.type';
import { PaginationDto } from 'src/users/dto/pagination.dto';
import { GetSessionsDto } from './dto/get-sessions.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { StorageService } from 'src/audio/storage/storage.service';
import { TranscriptionService } from 'src/ai/transcription/transcription.service';
import { SummarizationService } from 'src/ai/summarization/summarization.service';
import { ProcessSessionDto } from './dto/process-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly themesRepository: ThemesRepository,
    private readonly themePointRepository: ThemePointsRepository,
    private readonly database: DatabaseService,
    private readonly storageService: StorageService,
    private readonly transcriptionService: TranscriptionService,
    private readonly summarizationService: SummarizationService,
  ) {}

  async findAll(userId, query: GetSessionsDto) {
    const { page, limit, favourite, tagId } = query;
    const offset = (page - 1) * limit;

    const result = await this.sessionsRepository.findAll({
      userId,
      limit,
      offset,
      favourite,
      tagId,
    });

    return {
      data: result.sessions,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async create(userId: string, data: CreateSessionInput) {
    return this.database.transaction(async (client) => {
      const session = await this.sessionsRepository.create(
        {
          userId,
          title: data.title,
          audioUrl: data.audioUrl,
          audioDurationSeconds: data.audioDurationSeconds,
          rawTranscript: data.rawTranscript,
          tagId: data.tagId,
        },
        client,
      );

      for (const [themeIndex, themeData] of data.themes.entries()) {
        const theme = await this.themesRepository.create(
          {
            sessionId: session.id,
            themeOrder: themeIndex + 1,
            themeTitle: themeData.title,
          },
          client,
        );

        for (const [pointIndex, pointData] of themeData.points.entries()) {
          await this.themePointRepository.create(
            {
              themeId: theme.id,
              pointOrder: pointIndex + 1,
              pointText: pointData.text,
            },
            client,
          );
        }
      }
      return session;
    });
  }

  async findById(id: string, userId: string) {
    const session = await this.sessionsRepository.findById(id, userId);

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async updateFavourite(id: string, userId: string, favourite: boolean) {
    console.log('favourite: ', favourite);
    const session = await this.sessionsRepository.updateFavourite(
      id,
      userId,
      favourite,
    );

    if (!session) {
      throw new NotFoundException(`Session not found`);
    }

    return session;
  }

  async delete(id: string, userId: string) {
    const session = await this.sessionsRepository.delete(id, userId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return {
      message: 'Session deleted successfully',
    };
  }

  async update(id: string, userId: string, data: UpdateSessionDto) {
    return this.database.transaction(async (client) => {
      const session = await this.sessionsRepository.update(
        id,
        userId,
        data,
        client,
      );
      console.log('PAYLOAD', id, userId, data, session);
      if (!session) {
        throw new NotFoundException('Session not found');
      }
      if (data.themes !== undefined) {
        await this.themesRepository.deleteBySessionId(id, client);

        for (const [themeIndex, themeData] of data.themes.entries()) {
          const theme = await this.themesRepository.create(
            {
              sessionId: id,
              themeOrder: themeIndex + 1,
              themeTitle: themeData.title,
            },
            client,
          );

          for (const [pointIndex, pointData] of themeData.points.entries()) {
            await this.themePointRepository.create(
              {
                themeId: theme.id,
                pointOrder: pointIndex + 1,
                pointText: pointData.text,
              },
              client,
            );
          }
        }
      }
      return session;
    });
  }

  async process(
    userId: string,
    file: Express.Multer.File,
    data: ProcessSessionDto,
  ) {
    const uploadedAudio = await this.storageService.upload(file);

    try {
      const transcript = await this.transcriptionService.transcribe(
        file.buffer,
        file.mimetype,
      );

      const summary = await this.summarizationService.summarize(transcript);

      return this.database.transaction(async (client) => {
        const session = await this.sessionsRepository.create(
          {
            userId,
            title: data.title,
            audioUrl: uploadedAudio.url,
            audioDurationSeconds: data.audioDurationSeconds,
            rawTranscript: transcript,
            tagId: data.tagId,
          },
          client,
        );

        for (const [themeIndex, themeData] of summary.themes.entries()) {
          const theme = await this.themesRepository.create(
            {
              sessionId: session.id,
              themeOrder: themeIndex + 1,
              themeTitle: themeData.title,
            },
            client,
          );

          for (const [pointIndex, pointText] of themeData.points.entries()) {
            await this.themePointRepository.create(
              {
                themeId: theme.id,
                pointOrder: pointIndex + 1,
                pointText,
              },
              client,
            );
          }
        }

        return session;
      });
    } catch (error) {
      await this.storageService.delete(uploadedAudio.key);

      throw error;
    }
  }
}
