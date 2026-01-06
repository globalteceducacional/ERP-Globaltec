import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async validateUser(email: string, senha: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { email },
      include: {
        cargo: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(senha, user.senha);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.ativo) {
      throw new UnauthorizedException('Usuário inativo. Aguarde aprovação.');
    }

    return this.mapCargoPermissions(user);
  }

  async login(payload: LoginDto) {
    const user = await this.validateUser(payload.email, payload.senha);
    const userWithCargo = await this.prisma.usuario.findUnique({
      where: { id: user.id },
      include: {
        cargo: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    const mappedUser = this.mapCargoPermissions(userWithCargo);
    const token = this.jwtService.sign({ sub: user.id, role: mappedUser?.cargo?.nome || 'EXECUTOR' });
    return { token, user: mappedUser };
  }

  async register(data: RegisterDto) {
    const emailExists = await this.prisma.usuario.findUnique({ where: { email: data.email } });
    if (emailExists) {
      throw new BadRequestException('E-mail já cadastrado');
    }

    // Buscar cargo por nome ou ID
    let cargo;
    if (typeof data.cargo === 'string') {
      cargo = await this.prisma.cargo.findUnique({ where: { nome: data.cargo.toUpperCase() } });
      if (!cargo) {
        throw new BadRequestException('Cargo não encontrado');
      }
    } else {
      cargo = await this.prisma.cargo.findUnique({ where: { id: data.cargo } });
      if (!cargo) {
        throw new BadRequestException('Cargo não encontrado');
      }
    }

    const hashedPassword = await bcrypt.hash(data.senha, 10);

    const user = await this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: hashedPassword,
        cargoId: cargo.id,
        telefone: data.telefone,
        formacao: data.formacao,
        funcao: data.funcao,
        dataNascimento: data.dataNascimento ? new Date(data.dataNascimento) : undefined,
      },
      include: {
        cargo: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    return { user: this.mapCargoPermissions(user) };
  }

  private mapCargoPermissions(user: any) {
    if (!user?.cargo) {
      return user;
    }

    const permissions = user.cargo.permissions?.map((relation) => ({
      id: relation.permissionId,
      modulo: relation.permission.modulo,
      acao: relation.permission.acao,
      chave: `${relation.permission.modulo}:${relation.permission.acao}`,
      descricao: relation.permission.descricao,
    })) ?? [];

    return {
      ...user,
      cargo: {
        ...user.cargo,
        permissions,
      },
    };
  }
}
