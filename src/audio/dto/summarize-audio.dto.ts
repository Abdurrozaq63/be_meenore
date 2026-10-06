import { IsNotEmpty, IsString } from 'class-validator';

export class SummarizeAudioDto {
  @IsString()
  @IsNotEmpty()
  transcript: string;
}
