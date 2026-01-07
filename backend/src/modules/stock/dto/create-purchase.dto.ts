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
  @IsNumber()
  @Min(0)
  desconto?: number;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  fornecedorId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  formaPagamento?: string;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  projetoId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  etapaId?: number;

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

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorUnitario?: number; // Valor da cotação selecionada (opcional para solicitações)

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

  @IsOptional()
  dataCompra?: string; // Data da compra no formato ISO string (será convertida para DateTime)

  @IsOptional()
  @IsInt()
  @IsPositive()
  categoriaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}
