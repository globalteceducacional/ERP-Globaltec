import { IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitChecklistItemDto {
  @IsString()
  @MinLength(5)
  descricao: string;

  @IsOptional()
  @IsString()
  imagem?: string; // Base64 ou URL da imagem

  @IsOptional()
  @IsString()
  documento?: string; // Base64 ou URL do documento
}

