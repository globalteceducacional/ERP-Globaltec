import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChecklistItemStatus } from '@prisma/client';

export class ReviewChecklistItemDto {
  @IsEnum(ChecklistItemStatus)
  status: ChecklistItemStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

