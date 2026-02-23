import { StatusEntrega } from '@prisma/client';
import {
  IsArray,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchPurchaseToAcaminhoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  purchaseIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  formaPagamento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  nfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  comprovantePagamentoUrl?: string;

  @IsOptional()
  @IsString()
  dataCompra?: string;

  @IsOptional()
  @IsString()
  previsaoEntrega?: string;

  @IsOptional()
  @IsEnum(StatusEntrega)
  statusEntrega?: StatusEntrega;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  enderecoEntrega?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsOptional()
  @IsIn(['valor', 'porcentagem'])
  descontoTipo?: 'valor' | 'porcentagem';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  descontoValor?: number;
}
