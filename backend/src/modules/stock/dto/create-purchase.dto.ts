import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, IsArray, ValidateNested, ValidateIf, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CompraStatus } from '@prisma/client';

export class CotacaoDto {
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
  @MaxLength(50000) // Suporta imagens base64 comprimidas (aproximadamente 37KB)
  imagemUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000) // Suporta imagens base64 comprimidas (aproximadamente 37KB)
  nfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000) // Suporta imagens base64 comprimidas (aproximadamente 37KB)
  comprovantePagamentoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotacaoDto)
  cotacoes?: CotacaoDto[];

  @IsOptional()
  @IsEnum(CompraStatus)
  status?: CompraStatus;
}
