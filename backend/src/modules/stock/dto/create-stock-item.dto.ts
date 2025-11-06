import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, IsArray, ValidateNested, ValidateIf, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EstoqueStatus } from '@prisma/client';

export class CotacaoItemDto {
  @IsNumber()
  @IsPositive()
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

export class CreateStockItemDto {
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotacaoItemDto)
  cotacoes?: CotacaoItemDto[];

  @IsOptional()
  @IsEnum(EstoqueStatus)
  status?: EstoqueStatus;

  @IsOptional()
  @IsInt()
  @IsPositive()
  projetoId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  etapaId?: number;
}
