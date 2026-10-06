import {
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AudioService } from './audio.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { SummarizeAudioDto } from './dto/summarize-audio.dto';

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 25 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType:
              /^(audio\/mpeg|audio\/wav|audio\/x-wav|audio\/mp4|audio\/x-m4a)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.audioService.upload(file);
  }

  @Post('transcribe')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  transcribe(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 25 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType:
              /^(audio\/mpeg|audio\/wav|audio\/x-wav|audio\/mp4|audio\/x-m4a)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.audioService.transcribe(file);
  }

  @Post('process')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  process(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 25 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType:
              /^(audio\/mpeg|audio\/wav|audio\/x-wav|audio\/mp4|audio\/x-m4a)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.audioService.process(file);
  }

  @Post('summarize')
  @UseGuards(JwtAuthGuard)
  summarize(@Body() dto: SummarizeAudioDto) {
    return this.audioService.summarize(dto.transcript);
  }
}
