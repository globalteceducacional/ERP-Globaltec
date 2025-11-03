import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Cargo } from '@prisma/client';

export class RegisterDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  senha: string;

  @IsEnum(Cargo)
  cargo: Cargo;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  formacao?: string;

  @IsOptional()
  @IsString()
  funcao?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;
}
