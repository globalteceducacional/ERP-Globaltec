import { PartialType } from '@nestjs/mapped-types';
import { CreateCargoDto } from './create-cargo.dto';
import { IsOptional, IsString, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { CargoNivel } from '@prisma/client';

export class UpdateCargoDto extends PartialType(CreateCargoDto) {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paginasPermitidas?: string[];

  @IsOptional()
  @IsEnum(CargoNivel)
  nivelAcesso?: CargoNivel;

  @IsOptional()
  @IsBoolean()
  herdaPermissoes?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

