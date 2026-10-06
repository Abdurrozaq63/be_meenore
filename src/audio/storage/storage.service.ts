import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UTApi, UTFile } from 'uploadthing/server';

import { UploadAudio } from '../types/uploaded-audio.type';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly utapi: UTApi;

  constructor(private readonly configService: ConfigService) {
    this.utapi = new UTApi({
      token: this.configService.getOrThrow<string>('UPLOADTHING_TOKEN'),
    });
  }

  async upload(file: Express.Multer.File): Promise<UploadAudio> {
    try {
      const arrayBuffer = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      ) as ArrayBuffer;
      // 1. Buat Blob / Buffer biner murni untuk UTFile

      const uploadFile = new UTFile([arrayBuffer], file.originalname, {
        type: file.mimetype,
      });

      // 2. Upload file ke UploadThing
      const result = await this.utapi.uploadFiles(uploadFile);

      // 3. Tangani jika ada error bawaan dari response UploadThing SDK
      if (result.error) {
        console.error('UploadThing Error Details:', result.error);
        throw new InternalServerErrorException(
          `Failed to upload audio: ${result.error.message}`,
        );
      }

      if (!result.data) {
        throw new InternalServerErrorException('Failed to upload audio');
      }

      return {
        key: result.data.key,
        url: result.data.ufsUrl, // Menggunakan ufsUrl sesuai deprecation warning v8+
        fileName: result.data.name,
        mimeType: result.data.type,
        size: result.data.size,
      };
    } catch (error: any) {
      console.error('Upload Exception:', error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to upload audio file to storage',
      );
    }
  }

  async delete(fileKey: string): Promise<void> {
    try {
      await this.utapi.deleteFiles(fileKey);
    } catch (error) {
      console.error('Failed to delete uploaded file:', error);
    }
  }
}
