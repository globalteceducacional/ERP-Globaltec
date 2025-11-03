import { SetMetadata } from '@nestjs/common';
import { Cargo } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Cargo[]) => SetMetadata(ROLES_KEY, roles);
