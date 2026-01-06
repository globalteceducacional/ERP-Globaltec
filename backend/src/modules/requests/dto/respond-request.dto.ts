import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondRequestDto {
  @IsString()
  @MaxLength(1500)
  resposta: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  anexoResposta?: string;
}
