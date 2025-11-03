import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { FilterMyTasksDto } from './dto/filter-my-tasks.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { EtapaStatus, SubetapaStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyTasks(userId: number, filter: FilterMyTasksDto) {
    const where: Record<string, unknown> = {
      executorId: userId,
      iniciada: true,
    };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.projetoId) {
      where.projetoId = filter.projetoId;
    }

    return this.prisma.etapa.findMany({
      where,
      include: {
        projeto: true,
        subetapas: true,
      },
      orderBy: { dataInicio: 'asc' },
    });
  }

  async findOne(id: number) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: { include: { supervisor: true } },
        executor: true,
        subetapas: true,
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    return etapa;
  }

  async create(data: CreateTaskDto) {
    await this.ensureProjectExists(data.projetoId);
    await this.ensureUserExists(data.executorId);

    return this.prisma.etapa.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        projeto: { connect: { id: data.projetoId } },
        executor: { connect: { id: data.executorId } },
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        valorInsumos: data.valorInsumos ?? 0,
      },
      include: { executor: true, projeto: true },
    });
  }

  async update(id: number, data: UpdateTaskDto) {
    await this.findOne(id);

    // Preparar payload para o Prisma
    const payload: any = {
      nome: data.nome,
      descricao: data.descricao,
      status: data.status,
      valorInsumos: data.valorInsumos,
    };

    // Tratar datas
    if (data.dataInicio) {
      payload.dataInicio = new Date(data.dataInicio);
    }

    if (data.dataFim) {
      payload.dataFim = new Date(data.dataFim);
    }

    // Tratar executor (relação)
    if (data.executorId !== undefined) {
      if (data.executorId === null || data.executorId === 0) {
        throw new BadRequestException('Executor é obrigatório');
      } else {
        await this.ensureUserExists(data.executorId);
        payload.executor = { connect: { id: data.executorId } };
      }
    }

    // Tratar projeto (relação)
    if (data.projetoId !== undefined) {
      if (data.projetoId === null || data.projetoId === 0) {
        throw new BadRequestException('Projeto é obrigatório');
      } else {
        await this.ensureProjectExists(data.projetoId);
        payload.projeto = { connect: { id: data.projetoId } };
      }
    }

    // Remover campos undefined do payload
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return this.prisma.etapa.update({ where: { id }, data: payload });
  }

  async changeStatus(id: number, data: ChangeTaskStatusDto) {
    await this.findOne(id);

    return this.prisma.etapa.update({
      where: { id },
      data: {
        status: data.status,
        iniciada: typeof data.iniciada === 'boolean' ? data.iniciada : undefined,
      },
    });
  }

  async deliver(id: number, userId: number) {
    const etapa = await this.findOne(id);
    if (etapa.executorId !== userId) {
      throw new UnauthorizedException('Somente o executor pode entregar a tarefa');
    }

    if (etapa.status !== EtapaStatus.EM_ANDAMENTO && etapa.status !== EtapaStatus.PENDENTE) {
      throw new BadRequestException('A etapa não pode ser entregue no status atual');
    }

    return this.prisma.etapa.update({
      where: { id },
      data: { status: EtapaStatus.CONCLUIDA },
    });
  }

  async approve(id: number) {
    await this.findOne(id);
    return this.prisma.etapa.update({
      where: { id },
      data: { status: EtapaStatus.APROVADA },
    });
  }

  async reject(id: number, reason?: string) {
    await this.findOne(id);

    return this.prisma.etapa.update({
      where: { id },
      data: {
        status: EtapaStatus.EM_ANDAMENTO,
        iniciada: false,
        descricao: reason ? `${reason}` : undefined,
      },
    });
  }

  async createSubtask(data: CreateSubtaskDto) {
    await this.ensureTaskExists(data.etapaId);

    return this.prisma.subetapa.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        status: data.status ?? SubetapaStatus.PENDENTE,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        etapa: { connect: { id: data.etapaId } },
      },
    });
  }

  async updateSubtask(id: number, data: UpdateSubtaskDto) {
    await this.ensureSubtaskExists(id);

    const payload: any = { ...data };
    if ('dataInicio' in data && data.dataInicio) {
      payload.dataInicio = new Date(data.dataInicio);
    }
    if ('dataFim' in data && data.dataFim) {
      payload.dataFim = new Date(data.dataFim);
    }

    return this.prisma.subetapa.update({ where: { id }, data: payload });
  }

  async deleteSubtask(id: number) {
    await this.ensureSubtaskExists(id);
    await this.prisma.subetapa.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureProjectExists(id: number) {
    const project = await this.prisma.projeto.findUnique({ where: { id } });
    if (!project) {
      throw new BadRequestException('Projeto não encontrado');
    }
  }

  private async ensureUserExists(id: number) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('Usuário informado não existe');
    }
  }

  private async ensureTaskExists(id: number) {
    const task = await this.prisma.etapa.findUnique({ where: { id } });
    if (!task) {
      throw new BadRequestException('Etapa não encontrada');
    }
  }

  private async ensureSubtaskExists(id: number) {
    const subtask = await this.prisma.subetapa.findUnique({ where: { id } });
    if (!subtask) {
      throw new BadRequestException('Subetapa não encontrada');
    }
  }
}
