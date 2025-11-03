import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, IsArray, ValidateNested, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { CompraStatus } from '@prisma/client';

export class CotacaoDto {
  @IsNumber()
  @IsPositive()
  valorUnitario: number;

  @IsNumber()
  @IsPositive()
  frete: number;

  @IsNumber()
  @IsPositive()
  impostos: number;

  @IsOptional()
  @IsString()
  link?: string;
}

export class CreatePurchaseDto {
  @IsInt()
  projetoId: number;

  @IsString()
  @MaxLength(120)
  item: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsInt()
  @IsPositive()
  quantidade: number;

  @IsNumber()
  @IsPositive()
  valorUnitario: number; // Valor da cotação selecionada

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imagemUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotacaoDto)
  cotacoes?: CotacaoDto[];

  @IsOptional()
  @IsEnum(CompraStatus)
  status?: CompraStatus;
}
