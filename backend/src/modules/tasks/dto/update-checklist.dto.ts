import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChecklistSubItemDto {
  @IsString()
  @MaxLength(500)
  texto: string;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;
}

export class UpdateChecklistItemDto {
  @IsString()
  @MaxLength(500)
  texto: string;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateChecklistSubItemDto)
  subitens?: UpdateChecklistSubItemDto[];
}

export class UpdateChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateChecklistItemDto)
  checklist: UpdateChecklistItemDto[];
}

