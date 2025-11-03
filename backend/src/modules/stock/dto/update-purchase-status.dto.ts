import { CompraStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePurchaseStatusDto {
  @IsEnum(CompraStatus)
  status: CompraStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacao?: string;
}
