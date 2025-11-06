import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';

@Injectable()
export class CargosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cargo.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });
  }

  async findAllIncludingInactive() {
    return this.prisma.cargo.findMany({
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });
  }

  async findOne(id: number) {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });

    if (!cargo) {
      throw new NotFoundException('Cargo não encontrado');
    }

    return cargo;
  }

  async create(data: CreateCargoDto) {
    const nomeExists = await this.prisma.cargo.findUnique({
      where: { nome: data.nome.toUpperCase() },
    });

    if (nomeExists) {
      throw new BadRequestException('Já existe um cargo com este nome');
    }

    return this.prisma.cargo.create({
      data: {
        nome: data.nome.toUpperCase(),
        descricao: data.descricao,
        ativo: data.ativo ?? true,
        paginasPermitidas: data.paginasPermitidas || [],
      },
    });
  }

  async update(id: number, data: UpdateCargoDto) {
    await this.findOne(id);

    if (data.nome) {
      const nomeExists = await this.prisma.cargo.findUnique({
        where: { nome: data.nome.toUpperCase() },
      });

      if (nomeExists && nomeExists.id !== id) {
        throw new BadRequestException('Já existe um cargo com este nome');
      }
    }

    const payload: any = {};

    if (data.nome) {
      payload.nome = data.nome.toUpperCase();
    }

    if (typeof data.descricao !== 'undefined') {
      payload.descricao = data.descricao;
    }

    if (typeof data.ativo !== 'undefined') {
      payload.ativo = data.ativo;
    }

    if (typeof data.paginasPermitidas !== 'undefined') {
      payload.paginasPermitidas = data.paginasPermitidas;
    }

    return this.prisma.cargo.update({
      where: { id },
      data: payload,
    });
  }

  async remove(id: number) {
    const cargo = await this.findOne(id);

    // Verificar se há usuários usando este cargo
    const usuariosCount = await this.prisma.usuario.count({
      where: { cargoId: id },
    });

    if (usuariosCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir este cargo. Existem ${usuariosCount} usuário(s) utilizando-o.`,
      );
    }

    await this.prisma.cargo.delete({
      where: { id },
    });
  }
}

