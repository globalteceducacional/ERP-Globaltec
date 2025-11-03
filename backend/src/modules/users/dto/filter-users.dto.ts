import { Cargo } from '@prisma/client';
import { IsEnum, IsOptional, IsBooleanString } from 'class-validator';

export class FilterUsersDto {
  @IsOptional()
  @IsEnum(Cargo)
  cargo?: Cargo;

  @IsOptional()
  @IsBooleanString()
  ativo?: string;
}
