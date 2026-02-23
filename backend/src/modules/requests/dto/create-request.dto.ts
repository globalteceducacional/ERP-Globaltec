import { IsEnum, IsInt, IsOptional, IsString, MaxLength, IsArray, ValidateNested, ValidateIf, IsPositive, IsNumber, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { RequerimentoTipo } from '@prisma/client';

export class CotacaoItemDto {
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

export class CompraItemDto {
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
  @IsString()
  @MaxLength(50000)
  imagemUrl?: string;


  @IsOptional()
  @IsInt()
  @IsPositive()
  categoriaId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  projetoId?: number;


  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotacaoItemDto)
  cotacoes?: CotacaoItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}

export class CreateRequestDto {
  @IsOptional()
  @IsInt()
  destinatarioId?: number;

  @IsOptional()
  @IsInt()
  etapaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  texto?: string;

  @IsOptional()
  @IsEnum(RequerimentoTipo)
  tipo?: RequerimentoTipo;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  anexo?: string;

  @ValidateIf((o) => o.tipo === 'COMPRA')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompraItemDto)
  itensCompra?: CompraItemDto[];
}
