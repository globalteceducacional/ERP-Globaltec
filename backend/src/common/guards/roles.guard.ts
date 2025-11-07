import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    const cargo = user.role as string;

    // GM tem acesso a tudo
    if (cargo === 'GM') {
      return true;
    }

    // Verificar se o cargo do usuário está na lista de cargos permitidos
    const hasPermission = requiredRoles.includes(cargo);

    if (!hasPermission) {
      throw new ForbiddenException('Você não tem permissão para realizar esta ação');
    }

    return true;
  }
}
