import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSetorDto } from './dto/create-setor.dto';
import { UpdateSetorDto } from './dto/update-setor.dto';

@Injectable()
export class SetoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listOptions() {
    return this.prisma.setor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async findAll(includeInactive = false) {
    return this.prisma.setor.findMany({
      where: includeInactive ? undefined : { ativo: true },
      include: {
        membros: {
          include: {
            usuario: { select: { id: true, nome: true, email: true, cargo: { select: { id: true, nome: true } } } },
          },
        },
        _count: {
          select: {
            membros: true,
            projetos: true,
            compras: true,
            curadoriaOrcamentos: true,
          },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: number) {
    const setor = await this.prisma.setor.findUnique({
      where: { id },
      include: {
        membros: {
          include: {
            usuario: { select: { id: true, nome: true, email: true, cargo: { select: { id: true, nome: true } } } },
          },
        },
        _count: {
          select: {
            membros: true,
            projetos: true,
            compras: true,
            curadoriaOrcamentos: true,
          },
        },
      },
    });

    if (!setor) {
      throw new NotFoundException('Setor não encontrado');
    }

    return setor;
  }

  async create(dto: CreateSetorDto) {
    const nome = dto.nome?.trim();
    if (!nome) {
      throw new BadRequestException('Nome do setor é obrigatório');
    }

    const existing = await this.prisma.setor.findUnique({ where: { nome } });
    if (existing) {
      throw new BadRequestException('Já existe um setor com este nome');
    }

    return this.prisma.setor.create({
      data: {
        nome,
        descricao: dto.descricao?.trim() || null,
        ativo: dto.ativo ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateSetorDto) {
    const current = await this.findOne(id);
    const data: any = {};

    if (dto.nome !== undefined) {
      const nome = dto.nome?.trim();
      if (!nome) throw new BadRequestException('Nome do setor é obrigatório');
      if (nome !== current.nome) {
        const existing = await this.prisma.setor.findUnique({ where: { nome } });
        if (existing && existing.id !== id) {
          throw new BadRequestException('Já existe um setor com este nome');
        }
      }
      data.nome = nome;
    }

    if (dto.descricao !== undefined) {
      data.descricao = dto.descricao?.trim() || null;
    }

    if (dto.ativo !== undefined) {
      data.ativo = dto.ativo;
    }

    if (Object.keys(data).length === 0) {
      return current;
    }

    return this.prisma.setor.update({
      where: { id },
      data,
    });
  }

  async updateMembers(id: number, userIds: number[] | undefined) {
    await this.findOne(id);
    const ids = Array.isArray(userIds) ? Array.from(new Set(userIds)) : [];

    if (ids.length > 0) {
      const users = await this.prisma.usuario.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      if (users.length !== ids.length) {
        throw new BadRequestException('Um ou mais usuários informados não existem.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.setorUsuario.deleteMany({ where: { setorId: id } });
      if (ids.length > 0) {
        await tx.setorUsuario.createMany({
          data: ids.map((usuarioId) => ({ setorId: id, usuarioId })),
        });
      }
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const setor = await this.findOne(id);

    const linked = await this.prisma.$transaction([
      this.prisma.projeto.count({ where: { setorId: id } }),
      this.prisma.compra.count({ where: { setorId: id } }),
      this.prisma.curadoriaOrcamento.count({ where: { setorId: id } }),
    ]);
    const [projectsCount, purchasesCount, budgetsCount] = linked;

    if (projectsCount + purchasesCount + budgetsCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir o setor "${setor.nome}" porque ele está vinculado a projetos/compras/curadoria.`,
      );
    }

    await this.prisma.setorUsuario.deleteMany({ where: { setorId: id } });
    await this.prisma.setor.delete({ where: { id } });

    return { deleted: true };
  }
}

