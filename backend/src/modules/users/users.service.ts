import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterUsersDto) {
    const where: Record<string, unknown> = {};

    if (typeof filter.cargo !== 'undefined' && filter.cargo) {
      // Buscar cargo por nome e filtrar por cargoId
      const cargo = await this.prisma.cargo.findUnique({
        where: { nome: filter.cargo.toUpperCase() },
      });
      if (cargo) {
        where.cargoId = cargo.id;
      }
    }

    if (typeof filter.ativo !== 'undefined') {
      where.ativo = filter.ativo === 'true';
    }

    return this.prisma.usuario.findMany({
      where,
      include: { cargo: true },
      orderBy: { dataCadastro: 'desc' },
    });
  }

  async findOptions() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, cargo: { select: { nome: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      include: { cargo: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  async create(data: CreateUserDto) {
    const emailExists = await this.prisma.usuario.findUnique({ where: { email: data.email } });
    if (emailExists) {
      throw new BadRequestException('E-mail já cadastrado');
    }

    // Verificar se o cargo existe
    const cargo = await this.prisma.cargo.findUnique({ where: { id: data.cargoId } });
    if (!cargo) {
      throw new BadRequestException('Cargo não encontrado');
    }

    const hashedPassword = await bcrypt.hash(data.senha, 10);

    return this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: hashedPassword,
        cargoId: data.cargoId,
        telefone: data.telefone,
        formacao: data.formacao,
        funcao: data.funcao,
        dataNascimento: data.dataNascimento ? new Date(data.dataNascimento) : undefined,
        ativo: false, // Por padrão, novos usuários começam inativos
      },
      include: { cargo: true },
    });
  }

  async update(id: number, data: UpdateUserDto) {
    await this.findOne(id);

    if (data.email) {
      const emailExists = await this.prisma.usuario.findUnique({ where: { email: data.email } });
      if (emailExists && emailExists.id !== id) {
        throw new BadRequestException('E-mail já está em uso por outro usuário');
      }
    }

    const payload: Record<string, unknown> = {};

    if (data.nome) payload.nome = data.nome;
    if (data.email) payload.email = data.email;
    if (data.telefone !== undefined) payload.telefone = data.telefone;
    if (data.formacao !== undefined) payload.formacao = data.formacao;
    if (data.funcao !== undefined) payload.funcao = data.funcao;
    if (data.dataNascimento) payload.dataNascimento = new Date(data.dataNascimento);
    if (typeof data.ativo !== 'undefined') payload.ativo = data.ativo;

    if (data.cargoId) {
      // Verificar se o cargo existe
      const cargo = await this.prisma.cargo.findUnique({ where: { id: data.cargoId } });
      if (!cargo) {
        throw new BadRequestException('Cargo não encontrado');
      }
      payload.cargoId = data.cargoId;
    }

    // Só atualizar senha se ela foi fornecida e não está vazia
    if (typeof data.senha !== 'undefined' && data.senha && data.senha.trim().length > 0) {
      if (data.senha.trim().length < 6) {
        throw new BadRequestException('Senha deve ter no mínimo 6 caracteres');
      }
      payload.senha = await bcrypt.hash(data.senha.trim(), 10);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: payload,
      include: { cargo: true },
    });
  }

  async activate(id: number) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: true },
      include: { cargo: true },
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: false },
      include: { cargo: true },
    });
  }

  async assignRole(id: number, cargoId: number) {
    await this.findOne(id);
    
    // Verificar se o cargo existe
    const cargo = await this.prisma.cargo.findUnique({ where: { id: cargoId } });
    if (!cargo) {
      throw new BadRequestException('Cargo não encontrado');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: { cargoId },
      include: { cargo: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.usuario.delete({
      where: { id },
    });
  }

  async changePassword(userId: number, senhaAtual: string, novaSenha: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar senha atual
    const passwordMatches = await bcrypt.compare(senhaAtual, user.senha);
    if (!passwordMatches) {
      throw new BadRequestException('Senha atual incorreta');
    }

    // Validar nova senha
    if (novaSenha.trim().length < 6) {
      throw new BadRequestException('Nova senha deve ter no mínimo 6 caracteres');
    }

    // Atualizar senha
    const hashedPassword = await bcrypt.hash(novaSenha.trim(), 10);
    return this.prisma.usuario.update({
      where: { id: userId },
      data: { senha: hashedPassword },
      include: { cargo: true },
    });
  }
}
