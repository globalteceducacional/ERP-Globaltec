import { Cargo } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @IsEnum(Cargo)
  cargo: Cargo;
}
