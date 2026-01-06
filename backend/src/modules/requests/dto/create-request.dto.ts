import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRequestDto {
  @IsInt()
  destinatarioId: number;

  @IsOptional()
  @IsInt()
  etapaId?: number;

  @IsString()
  @MaxLength(1500)
  texto: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  anexo?: string;
}
