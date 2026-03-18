import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { FilterMyTasksDto } from './dto/filter-my-tasks.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto';
import { ChecklistItemStatus, EtapaEntregaStatus, EtapaStatus, ProjetoStatus, SubetapaStatus, Prisma } from '@prisma/client';
import { SubmitChecklistItemDto } from './dto/submit-checklist-item.dto';
import { ReviewChecklistItemDto } from './dto/review-checklist-item.dto';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listMyTasks(userId: number, filter: FilterMyTasksDto) {
    // Buscar apenas etapas em que o usuário é executor, integrante OU responsável (aprovação)
    const whereEtapas: Record<string, unknown> = {
      status: {
        in: [
          EtapaStatus.PENDENTE,
          EtapaStatus.EM_ANDAMENTO,
          EtapaStatus.EM_ANALISE,
          EtapaStatus.REPROVADA,
        ],
      },
      OR: [
        { executorId: userId },
        { integrantes: { some: { usuarioId: userId } } },
        { responsavelId: userId },
      ],
    };

    if (filter.projetoId) {
      whereEtapas.projetoId = filter.projetoId;
    }

    const etapasPendentes = await this.prisma.etapa.findMany({
      where: whereEtapas,
      include: {
        projeto: true,
        sessao: true,
        subetapas: true,
        executor: true,
        responsavel: true,
        integrantes: { include: { usuario: true } },
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: {
            executor: true,
            avaliadoPor: true,
            // editadoPor será reconhecido após rodar `prisma generate`
            editadoPor: true,
          } as any,
        },
        checklistEntregas: {
          orderBy: { checklistIndex: 'asc' },
          include: {
            executor: true,
            avaliadoPor: true,
          },
        },
      },
      orderBy: { dataInicio: 'asc' },
    });

    // Projetos a exibir: apenas os que têm pelo menos uma etapa onde o usuário é executor ou integrante
    const projetosIdsComEtapas = [...new Set(etapasPendentes.map((e) => e.projetoId))];
    const projetosResponsavel = await this.prisma.projeto.findMany({
      where: { id: { in: projetosIdsComEtapas } },
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
        etapas: {
          select: {
            id: true,
            status: true,
            valorInsumos: true,
          },
        },
      },
    });

    // Calcular progresso para cada projeto
    const projetosComProgresso = await Promise.all(
      projetosResponsavel.map(async (projeto) => {
        const totalEtapas = projeto.etapas.length;
        
        if (totalEtapas === 0) {
          return { ...projeto, progress: 0 };
        }
        
        // Buscar etapas completas com checklist para verificar se estão concluídas
        const etapasCompletas = await Promise.all(
          projeto.etapas.map(async (etapa) => {
            const etapaCompleta = await this.prisma.etapa.findUnique({
              where: { id: etapa.id },
              include: {
                checklistEntregas: true,
              },
            });
            
            if (!etapaCompleta) {
              const status = etapa.status as EtapaStatus;
              return status === EtapaStatus.EM_ANALISE || status === EtapaStatus.APROVADA;
            }
            
            const status = etapa.status as EtapaStatus;
            // Etapas com status EM_ANALISE ou APROVADA são consideradas concluídas
            if (status === EtapaStatus.EM_ANALISE || status === EtapaStatus.APROVADA) {
              return true;
            }
            
            // Se a etapa tem checklist, verificar se todos os itens (e subitens) foram concluídos
            if (etapaCompleta.checklistJson && Array.isArray(etapaCompleta.checklistJson)) {
              const checklist = etapaCompleta.checklistJson as Array<{
                texto: string;
                concluido?: boolean;
                subitens?: Array<{ texto: string; concluido?: boolean }>;
              }>;
              const totalItens = checklist.length;
              
              if (totalItens > 0) {
                // Considerar concluída apenas se TODOS os itens e TODOS os subitens estiverem concluídos
                const todosItensConcluidos = checklist.every((item) => {
                  const subitensOk =
                    !item.subitens || item.subitens.length === 0
                      ? true
                      : item.subitens.every((sub) => sub.concluido === true);
                  return item.concluido === true && subitensOk;
                });

                if (todosItensConcluidos) {
                  return true;
                }
              }
            }
            
            return false;
          })
        );
        
        const etapasConcluidas = etapasCompletas.filter(e => e === true).length;
        const progress = Math.round((etapasConcluidas / totalEtapas) * 100);
        
        return { ...projeto, progress };
      })
    );

    return {
      projetos: projetosComProgresso,
      etapasPendentes,
    };
  }

  async findOne(id: number) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: { include: { supervisor: true } },
        executor: true,
        responsavel: true,
        integrantes: { include: { usuario: true } },
        subetapas: true,
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: {
            executor: true,
            avaliadoPor: true,
            editadoPor: true,
          } as any,
        },
        checklistEntregas: {
          orderBy: { checklistIndex: 'asc' },
          include: {
            executor: true,
            avaliadoPor: true,
          },
        },
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

    const maxOrdem = await this.prisma.etapa.aggregate({
      where: { projetoId: data.projetoId },
      _max: { ordem: true },
    });
    const proximaOrdem = (maxOrdem._max?.ordem ?? -1) + 1;

    const createData: any = {
      ordem: proximaOrdem,
      nome: data.nome,
      descricao: data.descricao,
      aba: data.aba?.trim() || undefined,
      projeto: { connect: { id: data.projetoId } },
      executor: { connect: { id: data.executorId } },
      ...(data.sessaoId != null && data.sessaoId > 0
        ? { sessao: { connect: { id: data.sessaoId } } }
        : {}),
      dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
      dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
      valorInsumos: data.valorInsumos ?? 0,
    };

    if (data.checklist && Array.isArray(data.checklist) && data.checklist.length > 0) {
      createData.checklistJson = data.checklist as any;
    }

    if (data.responsavelId != null && data.responsavelId > 0) {
      await this.ensureUserExists(data.responsavelId);
      createData.responsavel = { connect: { id: data.responsavelId } };
    }

    const setorIdsToConnect: number[] | undefined =
      (Array.isArray((data as any).setorIds) ? (data as any).setorIds : undefined) ??
      (typeof data.setorId !== 'undefined'
        ? data.setorId > 0
          ? [data.setorId]
          : []
        : undefined);

    if (setorIdsToConnect && setorIdsToConnect.length > 0) {
      const idsUnique: number[] = Array.from(new Set(setorIdsToConnect)) as number[];
      for (const setorId of idsUnique) {
        await this.ensureSetorExists(setorId);
      }
      createData.setores = { connect: idsUnique.map((id) => ({ id })) };
    }

    // Tratar integrantes
    if (data.integrantesIds && Array.isArray(data.integrantesIds) && data.integrantesIds.length > 0) {
      // Validar que todos os IDs existem
      for (const integranteId of data.integrantesIds) {
        await this.ensureUserExists(integranteId);
      }
      createData.integrantes = {
        create: data.integrantesIds.map((usuarioId) => ({ usuarioId })),
      };
    }

    const created = await this.prisma.etapa.create({
      data: createData,
      include: {
        executor: true,
        responsavel: true,
        projeto: true,
        sessao: true,
        setores: true,
        integrantes: { include: { usuario: true } },
      } as any,
    });

    const createdAny = created as any;

    await this.updateProjetoStatus(createdAny.projetoId);

    // Notificar cada integrante (não falhar a criação da etapa se a notificação falhar)
    if (data.integrantesIds && data.integrantesIds.length > 0 && createdAny.projeto) {
      const projetoNome = createdAny.projeto.nome ?? 'Projeto';
      const etapaNome = createdAny.nome ?? 'Etapa';
      const mensagem = `Você foi adicionado como integrante da etapa "${etapaNome}" do projeto "${projetoNome}".`;
      const ids = data.integrantesIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0);
      for (const usuarioId of ids) {
        try {
          await this.notificationsService.create({
            usuarioId,
            titulo: 'Você foi adicionado a uma etapa',
            mensagem,
            tipo: 'INFO',
            etapaId: created.id,
          });
        } catch (err) {
          this.logger.warn(`Falha ao criar notificação para integrante ${usuarioId} (etapa ${created.id}): ${err}`);
        }
      }
    }

    return created;
  }

  async update(id: number, data: UpdateTaskDto) {
    await this.findOne(id);

    // Preparar payload para o Prisma
    const payload: any = {
      nome: data.nome,
      descricao: data.descricao,
      aba: data.aba?.trim(),
      status: data.status,
      valorInsumos: data.valorInsumos,
    };
    if (data.sessaoId !== undefined) {
      if (data.sessaoId == null || data.sessaoId === 0) {
        payload.sessao = { disconnect: true };
      } else {
        payload.sessao = { connect: { id: data.sessaoId } };
      }
    }

    // Tratar checklist
    if (data.checklist !== undefined) {
      if (Array.isArray(data.checklist) && data.checklist.length > 0) {
        payload.checklistJson = data.checklist as any;
      } else {
        payload.checklistJson = null;
      }
    }

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

    // Tratar responsável da etapa (quem pode aprovar/reprovar; opcional)
    if (data.responsavelId !== undefined) {
      if (data.responsavelId === null || data.responsavelId === 0) {
        payload.responsavel = { disconnect: true };
      } else {
        await this.ensureUserExists(data.responsavelId);
        payload.responsavel = { connect: { id: data.responsavelId } };
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

    // Tratar setores da etapa
    const hasSetorIds = (data as any).setorIds !== undefined;
    const hasSetorIdLegacy = (data as any).setorId !== undefined;

    if (hasSetorIds || hasSetorIdLegacy) {
      const setorIdsToSet: number[] =
        (hasSetorIds ? (Array.isArray((data as any).setorIds) ? (data as any).setorIds : []) : undefined) ??
        (typeof (data as any).setorId !== 'undefined' ? ((data as any).setorId > 0 ? [(data as any).setorId] : []) : []);

      const setorIdsUnique: number[] = Array.from(new Set(setorIdsToSet)) as number[];
      for (const setorId of setorIdsUnique) {
        await this.ensureSetorExists(setorId);
      }

      payload.setores = { set: setorIdsUnique.map((id) => ({ id })) };
    }

    const etapaAntes = await this.prisma.etapa.findUnique({
      where: { id },
      select: {
        checklistJson: true,
        integrantes: { select: { usuarioId: true } },
        projetoId: true,
      },
    });
    const idsAntigos = etapaAntes?.integrantes?.map((i) => i.usuarioId) ?? [];

    // Tratar integrantes
    if (data.integrantesIds !== undefined) {
      if (Array.isArray(data.integrantesIds) && data.integrantesIds.length > 0) {
        // Validar que todos os IDs existem
        for (const integranteId of data.integrantesIds) {
          await this.ensureUserExists(integranteId);
        }
        // Primeiro, deletar todos os integrantes existentes
        await this.prisma.etapaIntegrante.deleteMany({
          where: { etapaId: id },
        });
        // Depois, criar os novos
        payload.integrantes = {
          create: data.integrantesIds.map((usuarioId) => ({ usuarioId })),
        };
      } else {
        // Se array vazio, remover todos os integrantes
        await this.prisma.etapaIntegrante.deleteMany({
          where: { etapaId: id },
        });
      }
    }

    // Remover campos undefined do payload
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const updated = await this.prisma.etapa.update({
      where: { id },
      data: payload,
      include: { executor: true, responsavel: true, projeto: true, integrantes: { include: { usuario: true } } },
    });

    // Se a ordem do checklist mudou, reindexar ChecklistItemEntrega (checklistIndex)
    if (data.checklist !== undefined && Array.isArray(data.checklist) && data.checklist.length > 0 && etapaAntes?.checklistJson && Array.isArray(etapaAntes.checklistJson)) {
      const oldList = etapaAntes.checklistJson as Array<{ texto?: string; descricao?: string; subitens?: unknown[] }>;
      const newList = data.checklist as Array<{ texto?: string; descricao?: string; subitens?: unknown[] }>;
      const oldToNew: Record<number, number> = {};
      for (let newIdx = 0; newIdx < newList.length; newIdx++) {
        const newItem = newList[newIdx];
        const oldIdx = oldList.findIndex(
          (o) => o.texto === newItem.texto && (o.descricao ?? '') === (newItem.descricao ?? '') && (o.subitens?.length ?? 0) === (newItem.subitens?.length ?? 0)
        );
        if (oldIdx >= 0) oldToNew[oldIdx] = newIdx;
      }
      const entregas = await this.prisma.checklistItemEntrega.findMany({
        where: { etapaId: id },
        select: { id: true, checklistIndex: true },
      });
      for (const entrega of entregas) {
        const newIndex = oldToNew[entrega.checklistIndex];
        if (newIndex !== undefined && newIndex !== entrega.checklistIndex) {
          await this.prisma.checklistItemEntrega.update({
            where: { id: entrega.id },
            data: { checklistIndex: newIndex },
          });
        }
      }
    }

    await this.updateProjetoStatus(updated.projetoId);

    const novosIntegrantesIds = Array.isArray(data.integrantesIds) ? data.integrantesIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0) : [];
    const idsNovos = novosIntegrantesIds.filter((uid: number) => !idsAntigos.includes(uid));
    if (idsNovos.length > 0 && updated.projeto) {
      const projetoNome = updated.projeto.nome ?? 'Projeto';
      const etapaNome = updated.nome ?? 'Etapa';
      const mensagem = `Você foi adicionado como integrante da etapa "${etapaNome}" do projeto "${projetoNome}".`;
      for (const usuarioId of idsNovos) {
        try {
          await this.notificationsService.create({
            usuarioId,
            titulo: 'Você foi adicionado a uma etapa',
            mensagem,
            tipo: 'INFO',
            etapaId: updated.id,
          });
        } catch (err) {
          this.logger.warn(`Falha ao criar notificação para integrante ${usuarioId} (etapa ${id}): ${err}`);
        }
      }
    }

    return updated;
  }

  async changeStatus(id: number, data: ChangeTaskStatusDto) {
    await this.findOne(id);

    const updated = await this.prisma.etapa.update({
      where: { id },
      data: {
        status: data.status,
        iniciada: typeof data.iniciada === 'boolean' ? data.iniciada : undefined,
      },
    });

    await this.updateProjetoStatus(updated.projetoId);

    return updated;
  }

  async deliver(id: number, userId: number, data: SubmitDeliveryDto) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: { executor: true, avaliadoPor: true },
        },
        integrantes: {
          include: { usuario: true },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    // Verificar se o usuário é executor OU integrante da etapa
    const isExecutor = etapa.executorId === userId;
    const isIntegrante = etapa.integrantes?.some(
      (integrante) => integrante.usuarioId === userId,
    ) || false;

    if (!isExecutor && !isIntegrante) {
      throw new UnauthorizedException('Somente o executor ou integrantes podem entregar a etapa');
    }

    const statusAtual = etapa.status as EtapaStatus;
    const podeEntregarStatuses: EtapaStatus[] = [
      EtapaStatus.EM_ANDAMENTO,
      EtapaStatus.PENDENTE,
      EtapaStatus.REPROVADA,
    ];
    const podeEntregar = podeEntregarStatuses.includes(statusAtual as EtapaStatus);

    if (!podeEntregar) {
      throw new BadRequestException('A etapa não está disponível para entrega no status atual');
    }

    if (!data.descricao || data.descricao.trim().length < 5) {
      throw new BadRequestException('Descrição da entrega é obrigatória e deve ter pelo menos 5 caracteres');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.etapaEntrega.create({
        data: {
          descricao: data.descricao.trim(),
          imagemUrl: data.imagem ? data.imagem.trim() : null,
          etapaId: id,
          executorId: userId,
        },
      });

      await tx.etapa.update({
        where: { id },
        data: {
          status: EtapaStatus.EM_ANALISE,
          iniciada: true,
          dataFim: etapa.dataFim ?? new Date(),
        },
      });
    });

    const updated = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: true,
        subetapas: true,
        executor: true,
        integrantes: { include: { usuario: true } },
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: { executor: true, avaliadoPor: true },
        },
      },
    });

    if (updated) {
      await this.updateProjetoStatus(updated.projetoId);
    }

    return updated;
  }

  async updateDelivery(etapaId: number, entregaId: number, userId: number, data: SubmitDeliveryDto) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id: etapaId },
      include: {
        entregas: {
          where: { id: entregaId },
          include: { executor: true },
        },
        integrantes: {
          include: { usuario: true },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    const entrega = etapa.entregas[0];
    if (!entrega) {
      throw new NotFoundException('Entrega não encontrada');
    }

    // Verificar se o usuário é executor OU integrante da etapa
    const isExecutor = etapa.executorId === userId;
    const isIntegrante = etapa.integrantes?.some(
      (integrante) => integrante.usuarioId === userId,
    ) || false;

    if (!isExecutor && !isIntegrante) {
      throw new UnauthorizedException('Somente o executor ou integrantes podem editar a entrega');
    }

    if (!data.descricao || data.descricao.trim().length < 5) {
      throw new BadRequestException('Descrição da entrega é obrigatória e deve ter pelo menos 5 caracteres');
    }

    // Atualizar a entrega e marcar quem editou
    await this.prisma.etapaEntrega.update({
      where: { id: entregaId },
      data: {
        descricao: data.descricao.trim(),
        imagemUrl: data.imagem ? data.imagem.trim() : entrega.imagemUrl,
        foiEditada: true,
        editadoPorId: userId,
        dataEdicao: new Date(),
      } as any,
    });

    const updated = await this.prisma.etapa.findUnique({
      where: { id: etapaId },
      include: {
        projeto: true,
        subetapas: true,
        executor: true,
        integrantes: { include: { usuario: true } },
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: { executor: true, avaliadoPor: true, editadoPor: true } as any,
        },
      },
    });

    return updated;
  }

  async updateChecklist(id: number, userId: number, checklist: Array<{ 
    texto: string; 
    concluido?: boolean | string | number;
    descricao?: string;
    subitens?: Array<{ texto: string; concluido?: boolean; descricao?: string }>;
  }>) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: {
          include: {
            supervisor: true,
          },
        },
        responsavel: true,
        integrantes: {
          include: { usuario: true },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    // Buscar informações do usuário para verificar cargo
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { cargo: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se o usuário é GM/DIRETOR
    const isDiretor = user.cargo.nome === 'DIRETOR' || user.cargo.nome === 'GM';
    
    // Verificar se o usuário é supervisor do projeto
    const isSupervisorProjeto = etapa.projeto?.supervisor?.id === userId;
    // Verificar se o usuário é responsável da etapa (pode aprovar/reprovar pela tela Meu trabalho, sem acesso à aba Projetos)
    const isResponsavelEtapa = etapa.responsavelId === userId;

    // Usuário pode atualizar checklist se for GM/DIRETOR OU supervisor do projeto OU responsável da etapa
    if (!isDiretor && !isSupervisorProjeto && !isResponsavelEtapa) {
      throw new UnauthorizedException('Somente o supervisor do projeto, o responsável da etapa ou GM/DIRETOR podem atualizar o checklist');
    }

    // Normalizar valores booleanos do checklist - garantir valores explícitos
    // Preservar campos adicionais: descricao e subitens
    const normalizedChecklist = checklist.map((item) => {
      const concluido = Boolean(
        item.concluido === true ||
        item.concluido === 'true' ||
        item.concluido === 1 ||
        item.concluido === '1',
      );
      
      // Normalizar subitens se existirem
      const normalizedSubitens = item.subitens?.map((sub) => ({
        texto: sub.texto,
        concluido: Boolean(sub.concluido),
        descricao: sub.descricao || '',
      })) || [];
      
      return {
        texto: item.texto,
        concluido,
        descricao: item.descricao || '',
        subitens: normalizedSubitens,
      };
    });

    const updateData: any = {
      checklistJson: normalizedChecklist as any,
    };

    // Verificar se todos os itens do checklist estão marcados como concluídos
    const totalItens = normalizedChecklist.length;
    const todosConcluidos = totalItens > 0 && normalizedChecklist.every((item) => item.concluido === true);
    const algumConcluido = normalizedChecklist.some((item) => item.concluido === true);

    // Status permitidos para atualização automática (exceto REPROVADA que requer ação manual)
    const statusAtual = etapa.status as EtapaStatus;
    const podeAtualizarStatus = statusAtual !== EtapaStatus.REPROVADA;

    // Debug: Log detalhado para verificar a verificação
    console.log(`[updateChecklist] Etapa ${id}:`, {
      totalItens,
      todosConcluidos,
      statusAtual,
      podeAtualizarStatus,
      checklist: normalizedChecklist.map(item => ({ texto: item.texto, concluido: item.concluido })),
    });

    // Lógica de atualização de status baseada nas checkboxes:
    // - Nenhum checkbox marcado: PENDENTE
    // - Pelo menos 1 marcado: EM_ANDAMENTO
    // - Todos marcados: APROVADA (Completo)
    
    // Só atualizar status se não estiver REPROVADA (que requer ação manual)
    if (statusAtual !== EtapaStatus.REPROVADA) {
      if (totalItens === 0) {
        // Se não há itens no checklist, manter o status atual ou definir como PENDENTE
        if (statusAtual === EtapaStatus.APROVADA) {
          updateData.status = EtapaStatus.PENDENTE;
          updateData.dataFim = null;
        }
      } else if (todosConcluidos) {
        // TODOS os checkboxes marcados: APROVADA (Completo)
        updateData.status = EtapaStatus.APROVADA;
        // Se ainda não tem data de fim, definir como agora
        if (!etapa.dataFim) {
          updateData.dataFim = new Date();
        }
        console.log(`[updateChecklist] ✅ Etapa ${id} COMPLETA - todas as ${totalItens} checkboxes marcadas -> APROVADA`);
      } else if (algumConcluido) {
        // PELO MENOS 1 checkbox marcado: EM_ANDAMENTO
        // Mas só se não estiver em EM_ANALISE (aguardando avaliação)
        if (statusAtual !== EtapaStatus.EM_ANALISE) {
          updateData.status = EtapaStatus.EM_ANDAMENTO;
        }
        // Se estava APROVADA e agora não está mais, limpar dataFim
        if (statusAtual === EtapaStatus.APROVADA) {
          updateData.dataFim = null;
        }
        console.log(`[updateChecklist] 🔄 Etapa ${id} em andamento - ${normalizedChecklist.filter(item => item.concluido).length}/${totalItens} checkboxes marcadas -> EM_ANDAMENTO`);
      } else {
        // NENHUM checkbox marcado: PENDENTE
        // Mas só se não estiver em EM_ANALISE (aguardando avaliação)
        if (statusAtual !== EtapaStatus.EM_ANALISE) {
          updateData.status = EtapaStatus.PENDENTE;
    }
        // Se estava APROVADA e agora não está mais, limpar dataFim
        if (statusAtual === EtapaStatus.APROVADA) {
          updateData.dataFim = null;
        }
        console.log(`[updateChecklist] ⏳ Etapa ${id} pendente - nenhum checkbox marcado -> PENDENTE`);
      }
    } else {
      console.log(`[updateChecklist] ⚠️ Etapa ${id} está REPROVADA, não atualizando status automaticamente`);
    }

    // Log do que será atualizado
    console.log(`[updateChecklist] 📝 Dados a serem atualizados:`, JSON.stringify(updateData, null, 2));

    const updated = await this.prisma.etapa.update({
      where: { id },
      data: updateData,
      include: { executor: true, responsavel: true, projeto: true, integrantes: { include: { usuario: true } } },
    });

    // Log para confirmar a atualização
    console.log(`[updateChecklist] ✅ Etapa ${id} atualizada: status=${updated.status}, dataFim=${updated.dataFim}`);
    
    // Verificar se a atualização foi bem-sucedida
    if (todosConcluidos && updated.status !== EtapaStatus.APROVADA) {
      console.error(`[updateChecklist] ❌ ERRO: Todas as checkboxes estão marcadas mas o status não foi atualizado para APROVADA! Status atual: ${updated.status}`);
    }

    await this.updateProjetoStatus(updated.projetoId);

    return updated;
  }

  async submitChecklistItem(
    etapaId: number,
    checklistIndex: number,
    userId: number,
    data: SubmitChecklistItemDto,
    subitemIndex?: number,
  ) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id: etapaId },
      include: {
        integrantes: {
          include: { usuario: true },
        },
        checklistEntregas: true,
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    // Verificar se o usuário é executor OU integrante
    const isExecutor = etapa.executorId === userId;
    const isIntegrante = etapa.integrantes?.some(
      (integrante) => integrante.usuarioId === userId,
    ) || false;

    if (!isExecutor && !isIntegrante) {
      throw new UnauthorizedException('Somente o executor ou integrantes podem enviar entregas');
    }

    // Validar que o índice do checklist existe
    const checklist = (etapa.checklistJson as Array<{ 
      texto: string; 
      concluido?: boolean;
      subitens?: Array<{ texto: string; concluido?: boolean }>;
    }>) || [];
    
    if (checklistIndex < 0 || checklistIndex >= checklist.length) {
      throw new BadRequestException('Índice do checklist inválido');
    }

    // Se for subitem, validar que o subitem existe
    if (subitemIndex !== undefined && subitemIndex !== null) {
      const item = checklist[checklistIndex];
      if (!item.subitens || subitemIndex < 0 || subitemIndex >= item.subitens.length) {
        throw new BadRequestException('Índice do subitem inválido');
      }
    }

    if (!data.descricao || data.descricao.trim().length < 5) {
      throw new BadRequestException('Descrição é obrigatória e deve ter pelo menos 5 caracteres');
    }

    // Processar imagens: usar array se fornecido, senão usar campo único (compatibilidade)
    const imagensFieldProvided = data.imagens !== undefined || data.imagem !== undefined;
    let imagensUrls: string[] | null = null;
    if (Array.isArray(data.imagens)) {
      imagensUrls = data.imagens.filter((img) => img && img.trim().length > 0);
    } else if (data.imagem && data.imagem.trim().length > 0) {
      // Compatibilidade com formato antigo
      imagensUrls = [data.imagem.trim()];
    }

    // Processar documentos: usar array se fornecido, senão usar campo único (compatibilidade)
    const documentosFieldProvided = data.documentos !== undefined || data.documento !== undefined;
    let documentosUrls: string[] | null = null;
    if (Array.isArray(data.documentos)) {
      documentosUrls = data.documentos.filter((doc) => doc && doc.trim().length > 0);
    } else if (data.documento && data.documento.trim().length > 0) {
      // Compatibilidade com formato antigo
      documentosUrls = [data.documento.trim()];
    }

    // Buscar entrega existente (item principal ou subitem)
    // Primeiro tentar buscar com subitemIndex específico
    let entregaExistente: any = null;
    
    if (subitemIndex !== undefined && subitemIndex !== null) {
      // Buscar entrega do subitem específico
      entregaExistente = await this.prisma.checklistItemEntrega.findFirst({
      where: {
          etapaId,
          checklistIndex,
          subitemIndex: subitemIndex,
        } as any,
      });
    } else {
      // Buscar entrega do item principal (subitemIndex = null)
      entregaExistente = await this.prisma.checklistItemEntrega.findFirst({
        where: {
          etapaId,
          checklistIndex,
          subitemIndex: null,
        } as any,
      });
    }
    
    // Se não encontrou e é um subitem, também tentar buscar sem filtrar por subitemIndex
    // (para compatibilidade com constraint antiga que pode não ter subitemIndex)
    if (!entregaExistente && subitemIndex !== undefined && subitemIndex !== null) {
      const todasEntregas = await this.prisma.checklistItemEntrega.findMany({
        where: {
          etapaId,
          checklistIndex,
        },
      });
      
      // Se só existe uma entrega e ela não tem subitemIndex (ou é null), usar ela
      if (todasEntregas.length === 1) {
        const entrega = todasEntregas[0] as any;
        if (entrega.subitemIndex === null || entrega.subitemIndex === undefined) {
          entregaExistente = entrega;
        }
      }
    }

    // Função auxiliar para preparar dados de update
    const prepareUpdateData = (existent: any) => {
      // Ao reenviar, substituir completamente as listas de arquivos
      // Regras:
      // - Se o campo foi enviado (imagens/documentos definidos), mesmo vazio -> limpar/definir conforme enviado
      // - Se o campo não foi enviado -> manter o que já existia
      let novasImagens: string[] | undefined;
      if (imagensFieldProvided) {
        // Se veio array (mesmo vazio), usamos exatamente o que veio
        novasImagens = imagensUrls && imagensUrls.length > 0 ? imagensUrls : [];
      } else if (Array.isArray(existent.imagensUrls) && existent.imagensUrls.length > 0) {
        novasImagens = existent.imagensUrls as string[];
      }

      let novosDocumentos: string[] | undefined;
      if (documentosFieldProvided) {
        novosDocumentos = documentosUrls && documentosUrls.length > 0 ? documentosUrls : [];
      } else if (Array.isArray(existent.documentosUrls) && existent.documentosUrls.length > 0) {
        novosDocumentos = existent.documentosUrls as string[];
      }

      // Calcular arquivos antigos que foram removidos nesta edição
      const arquivosRemovidosExistentes: string[] = Array.isArray(existent.arquivosRemovidos)
        ? (existent.arquivosRemovidos as string[])
        : [];

      const imagensAntigas: string[] = [];
      if (Array.isArray(existent.imagensUrls)) {
        imagensAntigas.push(...(existent.imagensUrls as string[]));
      }
      if (existent.imagemUrl) {
        imagensAntigas.push(existent.imagemUrl as string);
      }

      const documentosAntigos: string[] = [];
      if (Array.isArray(existent.documentosUrls)) {
        documentosAntigos.push(...(existent.documentosUrls as string[]));
      }
      if (existent.documentoUrl) {
        documentosAntigos.push(existent.documentoUrl as string);
      }

      const imagensFinais = novasImagens ?? imagensAntigas;
      const documentosFinais = novosDocumentos ?? documentosAntigos;

      const removidasImagens = imagensAntigas.filter((url) => !imagensFinais.includes(url));
      const removidosDocumentos = documentosAntigos.filter((url) => !documentosFinais.includes(url));

      const arquivosRemovidos: string[] = [...arquivosRemovidosExistentes];
      [...removidasImagens, ...removidosDocumentos].forEach((url) => {
        if (url && typeof url === 'string' && !arquivosRemovidos.includes(url)) {
          arquivosRemovidos.push(url);
        }
      });

      // Controlar também os campos legados imagemUrl/documentoUrl:
      // - Se o campo foi enviado e a nova lista está vazia -> limpar (null)
      // - Se o campo foi enviado e há itens -> usar o primeiro da lista
      // - Se o campo não foi enviado -> manter o valor atual
      let imagemUrl = existent.imagemUrl as string | null | undefined;
      if (imagensFieldProvided) {
        if (imagensFinais && imagensFinais.length > 0) {
          imagemUrl = imagensFinais[0];
        } else {
          imagemUrl = null;
        }
      }

      let documentoUrl = existent.documentoUrl as string | null | undefined;
      if (documentosFieldProvided) {
        if (documentosFinais && documentosFinais.length > 0) {
          documentoUrl = documentosFinais[0];
        } else {
          documentoUrl = null;
        }
      }

      return {
        descricao: data.descricao.trim(),
        imagemUrl,
        documentoUrl,
        imagensUrls: imagensFinais,
        documentosUrls: documentosFinais,
        arquivosRemovidos: arquivosRemovidos.length > 0 ? (arquivosRemovidos as any) : Prisma.DbNull,
        status: ChecklistItemStatus.EM_ANALISE,
        dataEnvio: new Date(),
        comentario: null,
        avaliadoPorId: null,
        dataAvaliacao: null,
      };
    };

    // Criar ou atualizar a entrega do item do checklist (ou subitem)
    let entrega;
    
    if (entregaExistente) {
      // Atualizar entrega existente
      entrega = await this.prisma.checklistItemEntrega.update({
        where: { id: entregaExistente.id },
        data: prepareUpdateData(entregaExistente),
        include: {
          executor: true,
          avaliadoPor: true,
        },
      });
    } else {
      // Tentar criar nova entrega
      try {
        entrega = await this.prisma.checklistItemEntrega.create({
          data: {
            etapaId,
            checklistIndex,
            ...(subitemIndex !== undefined && subitemIndex !== null ? { subitemIndex } : { subitemIndex: null }),
            descricao: data.descricao.trim(),
            imagemUrl: imagensUrls && imagensUrls.length > 0 ? imagensUrls[0] : null,
            documentoUrl: documentosUrls && documentosUrls.length > 0 ? documentosUrls[0] : null,
            imagensUrls: imagensUrls && imagensUrls.length > 0 ? imagensUrls : undefined,
            documentosUrls: documentosUrls && documentosUrls.length > 0 ? documentosUrls : undefined,
            status: ChecklistItemStatus.EM_ANALISE,
            executorId: userId,
          } as any,
          include: {
            executor: true,
            avaliadoPor: true,
          },
        });
      } catch (error: any) {
        // Se der erro de constraint única, buscar novamente e atualizar
        if (
          error.code === 'P2002' ||
          error.message?.includes('Unique constraint') ||
          (error.message?.includes('etapaId') && error.message?.includes('checklistIndex'))
        ) {
          // Buscar qualquer entrega existente para este (etapaId, checklistIndex)
          // independente do subitemIndex (para compatibilidade com constraint antiga)
          const todasEntregas = await this.prisma.checklistItemEntrega.findMany({
            where: {
              etapaId,
              checklistIndex,
            },
          });
          
          if (todasEntregas.length > 0) {
            // Usar a primeira encontrada (ou a que tem subitemIndex correspondente se existir)
            const entregaEncontrada =
              todasEntregas.find((e: any) =>
                subitemIndex !== undefined && subitemIndex !== null
                  ? e.subitemIndex === subitemIndex
                  : e.subitemIndex === null || e.subitemIndex === undefined,
              ) || todasEntregas[0];
            
            if (entregaEncontrada) {
              entrega = await this.prisma.checklistItemEntrega.update({
                where: { id: (entregaEncontrada as any).id },
                data: prepareUpdateData(entregaEncontrada as any),
                include: {
                  executor: true,
                  avaliadoPor: true,
                },
              });
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    // Ao reenviar uma entrega (especialmente depois de aprovada),
    // o item deve voltar para análise: limpar o "concluido" do checklist
    // e, se apropriado, colocar a etapa em EM_ANALISE novamente.
    if (checklist.length > 0 && checklistIndex >= 0 && checklistIndex < checklist.length) {
      const item = checklist[checklistIndex];
      if (item) {
        if (subitemIndex !== undefined && subitemIndex !== null && item.subitens && item.subitens[subitemIndex]) {
          item.subitens[subitemIndex].concluido = false;
        } else {
          item.concluido = false;
        }

        const updateData: any = {
          checklistJson: checklist as any,
        };

        const statusAtual = etapa.status as EtapaStatus;
        if (statusAtual !== EtapaStatus.REPROVADA) {
          updateData.status = EtapaStatus.EM_ANALISE;
        }
        if (statusAtual === EtapaStatus.APROVADA) {
          updateData.dataFim = null;
        }

        await this.prisma.etapa.update({
          where: { id: etapaId },
          data: updateData,
        });

        // Atualizar o status agregado do projeto
        await this.updateProjetoStatus(etapa.projetoId);
      }
    }

    return entrega;
  }

  async reviewChecklistItem(
    etapaId: number,
    checklistIndex: number,
    reviewerId: number,
    data: ReviewChecklistItemDto,
    subitemIndex?: number,
  ) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id: etapaId },
      include: {
        projeto: {
          include: {
            supervisor: true,
          },
        },
        responsavel: true,
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    // Verificar se o usuário é supervisor do projeto, responsável da etapa ou diretor/GM
    const user = await this.prisma.usuario.findUnique({
      where: { id: reviewerId },
      include: { cargo: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const cargoNome = user.cargo.nome;
    const isSupervisorProjeto = etapa.projeto?.supervisor?.id === reviewerId;
    const isResponsavelEtapa = etapa.responsavelId === reviewerId;
    const isDiretor = cargoNome === 'DIRETOR' || cargoNome === 'GM';
    const isSupervisorCargo = cargoNome === 'SUPERVISOR';

    if (!isSupervisorProjeto && !isResponsavelEtapa && !isDiretor && !isSupervisorCargo) {
      throw new ForbiddenException('Somente o responsável da etapa, o supervisor do projeto ou cargos supervisor/diretor podem avaliar entregas');
    }

    const entrega = await this.prisma.checklistItemEntrega.findFirst({
      where: {
          etapaId,
          checklistIndex,
        ...(subitemIndex !== undefined && subitemIndex !== null ? { subitemIndex } : { subitemIndex: null }),
      } as any,
    });

    if (!entrega) {
      throw new NotFoundException('Entrega do item do checklist não encontrada');
    }

    if (entrega.status !== ChecklistItemStatus.EM_ANALISE) {
      throw new BadRequestException('Esta entrega já foi avaliada');
    }

    // Atualizar a entrega
    const updatedEntrega = await this.prisma.checklistItemEntrega.update({
      where: {
        id: entrega.id,
      },
      data: {
        status: data.status,
        comentario: data.comentario?.trim() || null,
        avaliadoPorId: reviewerId,
        dataAvaliacao: new Date(),
      },
      include: {
        executor: true,
        avaliadoPor: true,
      },
    });

    // Se aprovado, marcar o item do checklist (ou subitem) como concluído
    if (data.status === ChecklistItemStatus.APROVADO) {
      const checklist = (etapa.checklistJson as Array<{ 
        texto: string; 
        concluido?: boolean;
        subitens?: Array<{ texto: string; concluido?: boolean }>;
      }>) || [];
      
      if (subitemIndex !== undefined && subitemIndex !== null) {
        // Se for subitem, marcar o subitem como concluído
        const item = checklist[checklistIndex];
        if (item && item.subitens && item.subitens[subitemIndex]) {
          item.subitens[subitemIndex].concluido = true;
        }
      } else {
        // Se for item principal, marcar o item como concluído
      if (checklist[checklistIndex]) {
        checklist[checklistIndex].concluido = true;
        }
      }
      
      // Atualizar conclusão dos itens com base nos subitens
      checklist.forEach((item) => {
        if (item.subitens && item.subitens.length > 0) {
          const todosSubitensConcluidos = item.subitens.every((sub) => sub.concluido === true);
          // Se todos os subitens estiverem concluídos, marcar o item como concluído
          if (todosSubitensConcluidos && !item.concluido) {
            item.concluido = true;
          }
        }
      });

      // Verificar se todos os itens do checklist (e seus subitens) estão concluídos
      const totalItens = checklist.length;
      const todosConcluidos =
        totalItens > 0 &&
        checklist.every((item) => {
          const subitensOk =
            !item.subitens || item.subitens.length === 0
              ? true
              : item.subitens.every((sub) => sub.concluido === true);
          return item.concluido === true && subitensOk;
        });
      
      const updateData: any = {
        checklistJson: checklist,
      };
      
      // Se todos os itens estão marcados, atualizar status para APROVADA
      const podeAtualizarStatuses: EtapaStatus[] = [
        EtapaStatus.PENDENTE,
        EtapaStatus.EM_ANDAMENTO,
        EtapaStatus.APROVADA,
      ];
      const podeAtualizarStatus = podeAtualizarStatuses.includes(etapa.status as EtapaStatus);
      
      if (podeAtualizarStatus && todosConcluidos) {
        updateData.status = EtapaStatus.APROVADA;
        // Se ainda não tem data de fim, definir como agora
        if (!etapa.dataFim) {
          updateData.dataFim = new Date();
        }
      }
        
        await this.prisma.etapa.update({
          where: { id: etapaId },
        data: updateData,
        });
      
      // Atualizar status do projeto se necessário
      await this.updateProjetoStatus(etapa.projetoId);

      // Após aprovação, remover do storage os arquivos antigos marcados para remoção
      const arquivosRemovidos: string[] = Array.isArray((entrega as any).arquivosRemovidos)
        ? ((entrega as any).arquivosRemovidos as string[])
        : [];
      if (arquivosRemovidos.length > 0) {
        await this.deleteFilesFromStorage(arquivosRemovidos);
        await this.prisma.checklistItemEntrega.update({
          where: { id: entrega.id },
          data: { arquivosRemovidos: Prisma.DbNull },
        });
      }
    }

    return updatedEntrega;
  }

  async approve(id: number, reviewerId: number, comentario?: string) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: { include: { supervisor: true } },
        responsavel: true,
        entregas: {
          where: { status: EtapaEntregaStatus.EM_ANALISE },
          orderBy: { dataEnvio: 'desc' },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    const user = await this.prisma.usuario.findUnique({
      where: { id: reviewerId },
      include: { cargo: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const isResponsavelEtapa = etapa.responsavelId === reviewerId;
    const isSupervisorProjeto = etapa.projeto?.supervisor?.id === reviewerId;
    const isDiretorOuGM = user.cargo.nome === 'DIRETOR' || user.cargo.nome === 'GM';
    const isSupervisorCargo = user.cargo.nome === 'SUPERVISOR';
    if (!isResponsavelEtapa && !isSupervisorProjeto && !isDiretorOuGM && !isSupervisorCargo) {
      throw new ForbiddenException('Somente o responsável da etapa, o supervisor do projeto ou cargos supervisor/diretor podem aprovar entregas');
    }

    const entregaPendente = etapa.entregas[0];

    if (!entregaPendente) {
      throw new BadRequestException('Não há entrega pendente de análise para esta etapa');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.etapaEntrega.update({
        where: { id: entregaPendente.id },
        data: {
          status: EtapaEntregaStatus.APROVADA,
          comentario: comentario?.trim() || null,
          avaliadoPorId: reviewerId,
          dataAvaliacao: new Date(),
        },
      });

      await tx.etapa.update({
        where: { id },
        data: {
          status: EtapaStatus.APROVADA,
        },
      });
    });

    const updated = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: true,
        subetapas: true,
        executor: true,
        integrantes: { include: { usuario: true } },
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: { executor: true, avaliadoPor: true },
        },
      },
    });

    if (updated) {
      await this.updateProjetoStatus(updated.projetoId);
    }

    return updated;
  }

  async reject(id: number, reviewerId: number, reason?: string) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: { include: { supervisor: true } },
        responsavel: true,
        entregas: {
          where: { status: EtapaEntregaStatus.EM_ANALISE },
          orderBy: { dataEnvio: 'desc' },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    const user = await this.prisma.usuario.findUnique({
      where: { id: reviewerId },
      include: { cargo: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const isResponsavelEtapa = etapa.responsavelId === reviewerId;
    const isSupervisorProjeto = etapa.projeto?.supervisor?.id === reviewerId;
    const isDiretorOuGM = user.cargo.nome === 'DIRETOR' || user.cargo.nome === 'GM';
    const isSupervisorCargo = user.cargo.nome === 'SUPERVISOR';
    if (!isResponsavelEtapa && !isSupervisorProjeto && !isDiretorOuGM && !isSupervisorCargo) {
      throw new ForbiddenException('Somente o responsável da etapa, o supervisor do projeto ou cargos supervisor/diretor podem reprovar entregas');
    }

    const entregaPendente = etapa.entregas[0];

    if (!entregaPendente) {
      throw new BadRequestException('Não há entrega pendente de análise para esta etapa');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.etapaEntrega.update({
        where: { id: entregaPendente.id },
        data: {
          status: EtapaEntregaStatus.RECUSADA,
          comentario: reason?.trim() || null,
          avaliadoPorId: reviewerId,
          dataAvaliacao: new Date(),
        },
      });

      await tx.etapa.update({
        where: { id },
        data: {
          status: EtapaStatus.REPROVADA,
        },
      });
    });

    const updated = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        projeto: true,
        subetapas: true,
        executor: true,
        integrantes: { include: { usuario: true } },
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: { executor: true, avaliadoPor: true },
        },
      },
    });

    if (updated) {
      await this.updateProjetoStatus(updated.projetoId);
    }

    return updated;
  }

  private async deleteFilesFromStorage(urls: string[] | null | undefined) {
    if (!urls || !Array.isArray(urls)) {
      return;
    }

    for (const url of urls) {
      if (!url || typeof url !== 'string') {
        continue;
      }

      // Só tentar remover arquivos locais do diretório /uploads
      if (!url.startsWith('/uploads/')) {
        continue;
      }

      const relativePath = url.replace(/^\/+/, '');
      const absolutePath = join(process.cwd(), relativePath);

      try {
        await fs.promises.stat(absolutePath);
      } catch {
        // Arquivo já não existe mais
        continue;
      }

      try {
        await fs.promises.unlink(absolutePath);
      } catch (error) {
        this.logger.warn(`Falha ao excluir arquivo de upload "${absolutePath}": ${error}`);
      }
    }
  }

  private async updateProjetoStatus(projetoId: number) {
    const etapas = await this.prisma.etapa.findMany({
      where: { projetoId },
      select: { 
        status: true,
        valorInsumos: true,
      },
    });

    if (etapas.length === 0) {
      // Se não houver etapas, definir valorInsumos como 0
      await this.prisma.projeto.update({
        where: { id: projetoId },
        data: { valorInsumos: 0 },
      });
      return;
    }

    const total = etapas.length;
    const concluidas = etapas.filter((etapa) => {
      const status = etapa.status as EtapaStatus;
      return status === EtapaStatus.EM_ANALISE || status === EtapaStatus.APROVADA;
    }).length;
    const emAndamento = etapas.filter((etapa) => etapa.status === EtapaStatus.EM_ANDAMENTO).length;

    // Calcular valorInsumos como soma das etapas
    const valorInsumosCalculado = etapas.reduce((sum, etapa) => {
      return sum + (etapa.valorInsumos || 0);
    }, 0);

    let novoStatus: ProjetoStatus = ProjetoStatus.EM_ANDAMENTO;

    if (concluidas === total) {
      novoStatus = ProjetoStatus.FINALIZADO;
    } else if (concluidas === 0 && emAndamento === 0) {
      // Nenhuma etapa iniciada: manter EM_ANDAMENTO apenas se já houver etapas cadastradas
      novoStatus = ProjetoStatus.EM_ANDAMENTO;
    } else {
      novoStatus = ProjetoStatus.EM_ANDAMENTO;
    }

    await this.prisma.projeto.update({
      where: { id: projetoId },
      data: { 
        status: novoStatus,
        valorInsumos: valorInsumosCalculado,
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

  async remove(id: number) {
    const etapa = await this.findOne(id);
    
    // Deletar a etapa (as relações serão deletadas em cascata devido ao onDelete: Cascade no schema)
    await this.prisma.etapa.delete({
      where: { id },
    });

    // Atualizar status do projeto após deletar a etapa
    await this.updateProjetoStatus(etapa.projetoId);

    return { message: 'Etapa deletada com sucesso' };
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

  private async ensureSetorExists(id: number) {
    const setor = await this.prisma.setor.findUnique({ where: { id } });
    if (!setor) {
      throw new BadRequestException('Setor informado não existe');
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
