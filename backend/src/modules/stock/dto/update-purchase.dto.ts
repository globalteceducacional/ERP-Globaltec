import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CompraStatus } from '@prisma/client';

export class CotacaoUpdateDto {
  @IsNumber()
  @Min(0)
  valorUnitario: number;

  @IsNumber()
  @Min(0)
  frete: number;

  @IsNumber()
  @Min(0)
  impostos: number;

  @IsOptional()
  @IsString()
  link?: string;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  etapaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  item?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  quantidade?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorUnitario?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  imagemUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  nfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  comprovantePagamentoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotacaoUpdateDto)
  cotacoes?: CotacaoUpdateDto[];

  @IsOptional()
  @IsEnum(CompraStatus)
  status?: CompraStatus;
}

