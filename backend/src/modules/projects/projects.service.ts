import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateResponsiblesDto } from './dto/update-responsibles.dto';
import { ProjetoStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { status?: ProjetoStatus; search?: string }) {
    const where: Record<string, unknown> = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.nome = { 
        contains: params.search,
        mode: 'insensitive' as any, // Prisma PostgreSQL suporta insensitive
      };
    }

    return this.prisma.projeto.findMany({
      where,
      orderBy: { dataCriacao: 'desc' },
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
        _count: { select: { etapas: true } },
      },
    });
  }

  async findOne(id: number) {
    const project = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
        etapas: { include: { executor: true, subetapas: true } },
        compras: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    return project;
  }

  async create(data: CreateProjectDto) {
    if (data.valorInsumos && data.valorTotal && data.valorInsumos > data.valorTotal) {
      throw new BadRequestException('Valor de insumos não pode exceder o valor total do projeto');
    }

    const payload: any = {
      nome: data.nome,
      resumo: data.resumo,
      objetivo: data.objetivo,
      valorTotal: data.valorTotal ?? 0,
      valorInsumos: data.valorInsumos ?? 0,
      planilhaJson: data.planilhaJson ?? null,
    };

    if (data.supervisorId) {
      const supervisorExists = await this.prisma.usuario.findUnique({ where: { id: data.supervisorId } });
      if (!supervisorExists) {
        throw new BadRequestException('Supervisor informado não existe');
      }
      payload.supervisor = { connect: { id: data.supervisorId } };
    }

    const responsaveisData = data.responsavelIds?.map((usuarioId) => ({
      usuarioId,
    }));

    return this.prisma.projeto.create({
      data: {
        ...payload,
        responsaveis: responsaveisData ? { create: responsaveisData } : undefined,
      },
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
      },
    });
  }

  async update(id: number, data: UpdateProjectDto) {
    await this.findOne(id);

    if (data.valorInsumos && data.valorTotal && data.valorInsumos > data.valorTotal) {
      throw new BadRequestException('Valor de insumos não pode exceder o valor total do projeto');
    }

    // Preparar payload para o Prisma
    const payload: any = {
      nome: data.nome,
      resumo: data.resumo,
      objetivo: data.objetivo,
      valorTotal: data.valorTotal,
      valorInsumos: data.valorInsumos,
      status: data.status,
      planilhaJson: data.planilhaJson,
    };

    // Tratar supervisor (relação)
    if (data.supervisorId !== undefined) {
      if (data.supervisorId === null || data.supervisorId === 0) {
        payload.supervisor = { disconnect: true };
      } else {
        const supervisorExists = await this.prisma.usuario.findUnique({ where: { id: data.supervisorId } });
        if (!supervisorExists) {
          throw new BadRequestException('Supervisor informado não existe');
        }
        payload.supervisor = { connect: { id: data.supervisorId } };
      }
    }

    // Remover campos undefined do payload
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return this.prisma.projeto.update({
      where: { id },
      data: payload,
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
      },
    });
  }

  async updateResponsibles(id: number, data: UpdateResponsiblesDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.projetoResponsavel.deleteMany({ where: { projetoId: id } });

      const records = data.responsavelIds.map((usuarioId) => ({ projetoId: id, usuarioId }));

      await tx.projetoResponsavel.createMany({ data: records });

      return tx.projeto.findUnique({
        where: { id },
        include: { responsaveis: { include: { usuario: true } } },
      });
    });
  }

  async finalize(id: number) {
    await this.findOne(id);
    return this.prisma.projeto.update({
      where: { id },
      data: { status: ProjetoStatus.FINALIZADO, dataFinalizacao: new Date() },
    });
  }
}
