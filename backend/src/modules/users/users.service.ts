import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { Cargo } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterUsersDto) {
    const where: Record<string, unknown> = {};

    if (typeof filter.cargo !== 'undefined') {
      where.cargo = filter.cargo;
    }

    if (typeof filter.ativo !== 'undefined') {
      where.ativo = filter.ativo === 'true';
    }

    return this.prisma.usuario.findMany({
      where,
      orderBy: { dataCadastro: 'desc' },
    });
  }

  async findOptions() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  async update(id: number, data: UpdateUserDto) {
    await this.findOne(id);

    if (data.email) {
      const emailExists = await this.prisma.usuario.findUnique({ where: { email: data.email } });
      if (emailExists && emailExists.id !== id) {
        throw new BadRequestException('E-mail já está em uso por outro usuário');
      }
    }

    const payload: Record<string, unknown> = { ...data };

    if (typeof data.senha !== 'undefined') {
      payload.senha = await bcrypt.hash(data.senha, 10);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: payload,
    });
  }

  async activate(id: number) {
    await this.findOne(id);
    return this.prisma.usuario.update({ where: { id }, data: { ativo: true } });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
  }

  async assignRole(id: number, cargo: Cargo) {
    await this.findOne(id);
    return this.prisma.usuario.update({ where: { id }, data: { cargo } });
  }
}
