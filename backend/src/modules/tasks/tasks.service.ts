import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { FilterMyTasksDto } from './dto/filter-my-tasks.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto';
import { ChecklistItemStatus, EtapaEntregaStatus, EtapaStatus, ProjetoStatus, SubetapaStatus } from '@prisma/client';
import { SubmitChecklistItemDto } from './dto/submit-checklist-item.dto';
import { ReviewChecklistItemDto } from './dto/review-checklist-item.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyTasks(userId: number, filter: FilterMyTasksDto) {
    // Buscar projetos onde o usuário é responsável ou executor de etapas
    const projetosResponsavel = await this.prisma.projeto.findMany({
      where: {
        responsaveis: {
          some: {
            usuarioId: userId,
          },
        },
      },
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

    // Buscar IDs dos projetos onde o usuário é responsável
    const projetosIds = projetosResponsavel.map((p) => p.id);

    // Buscar etapas pendentes onde o usuário é executor OU onde o projeto tem o usuário como responsável
    const where: Record<string, unknown> = {
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
        ...(projetosIds.length > 0 ? [{ projetoId: { in: projetosIds } }] : []),
      ],
    };

    if (filter.projetoId) {
      where.projetoId = filter.projetoId;
      // Remover OR se filtro por projeto específico
      delete where.OR;
    }

    const etapasPendentes = await this.prisma.etapa.findMany({
      where,
      include: {
        projeto: true,
        subetapas: true,
        executor: true,
        integrantes: { include: { usuario: true } },
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: {
            executor: true,
            avaliadoPor: true,
          },
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
            
            // Se a etapa tem checklist, verificar se todos os itens foram aprovados
            if (etapaCompleta.checklistJson && Array.isArray(etapaCompleta.checklistJson)) {
              const checklist = etapaCompleta.checklistJson as Array<{ texto: string; concluido?: boolean }>;
              const totalItens = checklist.length;
              
              if (totalItens > 0) {
                // Verificar itens aprovados através das entregas do checklist
                const itensAprovados = etapaCompleta.checklistEntregas?.filter(
                  (entrega) => entrega.status === 'APROVADO'
                ).length || 0;
                
                // Verificar itens marcados como concluídos no checklistJson
                const itensMarcados = checklist.filter(
                  (item) => item.concluido === true
                ).length;
                
                // Se todos os itens foram aprovados OU marcados como concluídos, considerar concluída
                if (itensAprovados === totalItens || itensMarcados === totalItens) {
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
        integrantes: { include: { usuario: true } },
        subetapas: true,
        entregas: {
          orderBy: { dataEnvio: 'desc' },
          include: {
            executor: true,
            avaliadoPor: true,
          },
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

    const createData: any = {
        nome: data.nome,
        descricao: data.descricao,
        projeto: { connect: { id: data.projetoId } },
        executor: { connect: { id: data.executorId } },
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        valorInsumos: data.valorInsumos ?? 0,
    };

    if (data.checklist && Array.isArray(data.checklist) && data.checklist.length > 0) {
      createData.checklistJson = data.checklist as any;
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
      include: { executor: true, projeto: true, integrantes: { include: { usuario: true } } },
    });

    await this.updateProjetoStatus(created.projetoId);

    return created;
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

    // Tratar projeto (relação)
    if (data.projetoId !== undefined) {
      if (data.projetoId === null || data.projetoId === 0) {
        throw new BadRequestException('Projeto é obrigatório');
      } else {
        await this.ensureProjectExists(data.projetoId);
        payload.projeto = { connect: { id: data.projetoId } };
      }
    }

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
      include: { executor: true, projeto: true, integrantes: { include: { usuario: true } } },
    });

    await this.updateProjetoStatus(updated.projetoId);

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

    // Verificar se a entrega está em análise
    if (entrega.status !== EtapaEntregaStatus.EM_ANALISE) {
      throw new BadRequestException('Apenas entregas em análise podem ser editadas');
    }

    // Verificar se a etapa está em análise
    if (etapa.status !== EtapaStatus.EM_ANALISE) {
      throw new BadRequestException('A etapa deve estar em análise para editar a entrega');
    }

    if (!data.descricao || data.descricao.trim().length < 5) {
      throw new BadRequestException('Descrição da entrega é obrigatória e deve ter pelo menos 5 caracteres');
    }

    // Atualizar a entrega
    await this.prisma.etapaEntrega.update({
      where: { id: entregaId },
      data: {
        descricao: data.descricao.trim(),
        imagemUrl: data.imagem ? data.imagem.trim() : entrega.imagemUrl,
      },
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
          include: { executor: true, avaliadoPor: true },
        },
      },
    });

    return updated;
  }

  async updateChecklist(id: number, userId: number, checklist: Array<{ texto: string; concluido?: boolean | string | number }>) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
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
    const isIntegrante =
      etapa.integrantes?.some((integrante) => integrante.usuarioId === userId) || false;

    if (!isExecutor && !isIntegrante) {
      throw new UnauthorizedException('Somente o executor ou integrantes podem atualizar o checklist');
    }

    // Normalizar valores booleanos do checklist - garantir valores explícitos
    const normalizedChecklist = checklist.map((item) => ({
      texto: item.texto,
      concluido: Boolean(
        item.concluido === true ||
        item.concluido === 'true' ||
        item.concluido === 1 ||
        item.concluido === '1',
      ),
    }));

    const updateData: any = {
      checklistJson: normalizedChecklist as any,
    };

    const podeAtualizarStatuses: EtapaStatus[] = [
      EtapaStatus.PENDENTE,
      EtapaStatus.EM_ANDAMENTO,
    ];
    const podeAtualizarStatus = podeAtualizarStatuses.includes(etapa.status as EtapaStatus);
    const algumConcluido = normalizedChecklist.some((item) => item.concluido === true);

    if (podeAtualizarStatus) {
      updateData.status = algumConcluido ? EtapaStatus.EM_ANDAMENTO : EtapaStatus.PENDENTE;
    }

    const updated = await this.prisma.etapa.update({
      where: { id },
      data: updateData,
      include: { executor: true, projeto: true, integrantes: { include: { usuario: true } } },
    });

    await this.updateProjetoStatus(updated.projetoId);

    return updated;
  }

  async submitChecklistItem(
    etapaId: number,
    checklistIndex: number,
    userId: number,
    data: SubmitChecklistItemDto,
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
    const checklist = (etapa.checklistJson as Array<{ texto: string; concluido?: boolean }>) || [];
    if (checklistIndex < 0 || checklistIndex >= checklist.length) {
      throw new BadRequestException('Índice do checklist inválido');
    }

    if (!data.descricao || data.descricao.trim().length < 5) {
      throw new BadRequestException('Descrição é obrigatória e deve ter pelo menos 5 caracteres');
    }

    // Processar imagens: usar array se fornecido, senão usar campo único (compatibilidade)
    let imagensUrls: string[] | null = null;
    if (data.imagens && Array.isArray(data.imagens) && data.imagens.length > 0) {
      imagensUrls = data.imagens.filter(img => img && img.trim().length > 0);
    } else if (data.imagem && data.imagem.trim().length > 0) {
      // Compatibilidade com formato antigo
      imagensUrls = [data.imagem.trim()];
    }

    // Processar documentos: usar array se fornecido, senão usar campo único (compatibilidade)
    let documentosUrls: string[] | null = null;
    if (data.documentos && Array.isArray(data.documentos) && data.documentos.length > 0) {
      documentosUrls = data.documentos.filter(doc => doc && doc.trim().length > 0);
    } else if (data.documento && data.documento.trim().length > 0) {
      // Compatibilidade com formato antigo
      documentosUrls = [data.documento.trim()];
    }

    // Criar ou atualizar a entrega do item do checklist
    const entrega = await this.prisma.checklistItemEntrega.upsert({
      where: {
        etapaId_checklistIndex: {
          etapaId,
          checklistIndex,
        },
      },
      create: {
        etapaId,
        checklistIndex,
        descricao: data.descricao.trim(),
        imagemUrl: imagensUrls && imagensUrls.length > 0 ? imagensUrls[0] : null, // Mantido para compatibilidade
        documentoUrl: documentosUrls && documentosUrls.length > 0 ? documentosUrls[0] : null, // Mantido para compatibilidade
        imagensUrls: imagensUrls && imagensUrls.length > 0 ? imagensUrls : undefined,
        documentosUrls: documentosUrls && documentosUrls.length > 0 ? documentosUrls : undefined,
        status: ChecklistItemStatus.EM_ANALISE,
        executorId: userId,
      },
      update: {
        descricao: data.descricao.trim(),
        imagemUrl: imagensUrls && imagensUrls.length > 0 ? imagensUrls[0] : null, // Mantido para compatibilidade
        documentoUrl: documentosUrls && documentosUrls.length > 0 ? documentosUrls[0] : null, // Mantido para compatibilidade
        imagensUrls: imagensUrls && imagensUrls.length > 0 ? imagensUrls : undefined,
        documentosUrls: documentosUrls && documentosUrls.length > 0 ? documentosUrls : undefined,
        status: ChecklistItemStatus.EM_ANALISE,
        dataEnvio: new Date(),
        comentario: null,
        avaliadoPorId: null,
        dataAvaliacao: null,
      },
      include: {
        executor: true,
        avaliadoPor: true,
      },
    });

    return entrega;
  }

  async reviewChecklistItem(
    etapaId: number,
    checklistIndex: number,
    reviewerId: number,
    data: ReviewChecklistItemDto,
  ) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id: etapaId },
      include: {
        projeto: {
          include: {
            supervisor: true,
          },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
    }

    // Verificar se o usuário é supervisor ou diretor
    const user = await this.prisma.usuario.findUnique({
      where: { id: reviewerId },
      include: { cargo: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const cargoNome = user.cargo.nome;
    const isSupervisor = cargoNome === 'SUPERVISOR' || etapa.projeto?.supervisor?.id === reviewerId;
    const isDiretor = cargoNome === 'DIRETOR' || cargoNome === 'GM';

    if (!isSupervisor && !isDiretor) {
      throw new ForbiddenException('Somente supervisores ou diretores podem avaliar entregas');
    }

    const entrega = await this.prisma.checklistItemEntrega.findUnique({
      where: {
        etapaId_checklistIndex: {
          etapaId,
          checklistIndex,
        },
      },
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
        etapaId_checklistIndex: {
          etapaId,
          checklistIndex,
        },
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

    // Se aprovado, marcar o item do checklist como concluído
    if (data.status === ChecklistItemStatus.APROVADO) {
      const checklist = (etapa.checklistJson as Array<{ texto: string; concluido?: boolean }>) || [];
      if (checklist[checklistIndex]) {
        checklist[checklistIndex].concluido = true;
        
        await this.prisma.etapa.update({
          where: { id: etapaId },
          data: {
            checklistJson: checklist,
          },
        });
      }
    }

    return updatedEntrega;
  }

  async approve(id: number, reviewerId: number, comentario?: string) {
    const etapa = await this.prisma.etapa.findUnique({
      where: { id },
      include: {
        entregas: {
          where: { status: EtapaEntregaStatus.EM_ANALISE },
          orderBy: { dataEnvio: 'desc' },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
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
        entregas: {
          where: { status: EtapaEntregaStatus.EM_ANALISE },
          orderBy: { dataEnvio: 'desc' },
        },
      },
    });

    if (!etapa) {
      throw new NotFoundException('Etapa não encontrada');
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
