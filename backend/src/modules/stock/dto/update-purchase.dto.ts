import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength, IsArray, ValidateNested, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { CompraStatus, StatusEntrega } from '@prisma/client';

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
  @IsNumber()
  @Min(0)
  desconto?: number;

  @IsOptional()
  @IsIn(['valor', 'porcentagem'])
  descontoTipo?: 'valor' | 'porcentagem';

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

  @IsOptional()
  dataCompra?: string; // Data da compra no formato ISO string (será convertida para DateTime)

  @IsOptional()
  @IsInt()
  @IsPositive()
  categoriaId?: number;

  @IsOptional()
  @IsEnum(StatusEntrega)
  statusEntrega?: StatusEntrega;

  @IsOptional()
  @IsString()
  dataEntrega?: string; // Data da entrega no formato ISO string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  enderecoEntrega?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recebidoPor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}

