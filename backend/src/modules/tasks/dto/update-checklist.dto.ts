import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChecklistItemDto {
  @IsString()
  @MaxLength(500)
  texto: string;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}

export class UpdateChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateChecklistItemDto)
  checklist: UpdateChecklistItemDto[];
}

