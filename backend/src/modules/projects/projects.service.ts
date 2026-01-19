import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateResponsiblesDto } from './dto/update-responsibles.dto';
import { EtapaStatus, ProjetoStatus, NotificacaoTipo, RequerimentoTipo } from '@prisma/client';

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

    const projects = await this.prisma.projeto.findMany({
      where,
      orderBy: { dataCriacao: 'desc' },
      include: {
        supervisor: { include: { cargo: true } },
        responsaveis: { include: { usuario: { include: { cargo: true } } } },
        _count: { select: { etapas: true } },
        etapas: { 
          select: { 
            id: true,
            status: true,
            valorInsumos: true,
          } 
        },
      },
    });

    // Atualizar status do projeto no banco se necessário e calcular progresso
    const updatedProjects = await Promise.all(
      projects.map(async ({ etapas, ...project }) => {
        const totalEtapas = etapas.length;
        
        // Buscar etapas completas com checklist para verificar se estão concluídas
        const etapasCompletas = await Promise.all(
          etapas.map(async (etapa) => {
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
        const progress = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;

        // Calcular valorInsumos como soma das etapas
        const valorInsumosCalculado = etapas.reduce((sum, etapa) => {
          return sum + (etapa.valorInsumos || 0);
        }, 0);

        let novoStatus = project.status;
        if (progress === 100 && totalEtapas > 0) {
          novoStatus = ProjetoStatus.FINALIZADO;
        } else if (totalEtapas > 0) {
          novoStatus = ProjetoStatus.EM_ANDAMENTO;
        }

        // Sincronizar status no banco se houver discrepância
        if (novoStatus !== project.status) {
          await this.prisma.projeto.update({
            where: { id: project.id },
            data: { status: novoStatus },
          });
        }

        // Atualizar valorInsumos no banco se houver discrepância
        if (valorInsumosCalculado !== project.valorInsumos) {
          await this.prisma.projeto.update({
            where: { id: project.id },
            data: { valorInsumos: valorInsumosCalculado },
          });
        }

        return {
          ...project,
          status: novoStatus,
          valorInsumos: valorInsumosCalculado,
          progress: progress, // Garantir que progress seja sempre incluído
        };
      }),
    );

    return updatedProjects;
  }

  async findOne(id: number) {
    const project = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        supervisor: { include: { cargo: true } },
        responsaveis: { include: { usuario: { include: { cargo: true } } } },
        etapas: {
          orderBy: { id: 'asc' }, // Ordenar por ID (ordem de criação: primeira etapa criada, segunda, terceira...)
          include: {
            executor: true,
            integrantes: { include: { usuario: true } },
            subetapas: true,
            entregas: {
              orderBy: { dataEnvio: 'desc' },
              include: { executor: true, avaliadoPor: true },
            },
            checklistEntregas: {
              orderBy: { checklistIndex: 'asc' },
              include: {
                executor: true,
                avaliadoPor: true,
              },
            },
          },
        },
        compras: {
          include: {
            etapa: true,
            solicitadoPor: { include: { cargo: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Calcular valorInsumos como soma das etapas
    const valorInsumosCalculado = project.etapas.reduce((sum, etapa) => {
      return sum + (etapa.valorInsumos || 0);
    }, 0);

    // Atualizar valorInsumos no banco se houver discrepância
    if (valorInsumosCalculado !== project.valorInsumos) {
      await this.prisma.projeto.update({
        where: { id },
        data: { valorInsumos: valorInsumosCalculado },
      });
    }

    return {
      ...project,
      valorInsumos: valorInsumosCalculado,
    };
  }

  async create(data: CreateProjectDto) {
    const payload: any = {
      nome: data.nome,
      resumo: data.resumo,
      objetivo: data.objetivo,
      valorTotal: data.valorTotal ?? 0,
      valorInsumos: 0, // Sempre inicia com 0, será calculado automaticamente quando houver etapas
      planilhaJson: data.planilhaJson ?? null,
    };

    if (data.supervisorId) {
      const supervisorExists = await this.prisma.usuario.findUnique({ where: { id: data.supervisorId } });
      if (!supervisorExists) {
        throw new BadRequestException('Supervisor informado não existe');
      }
      payload.supervisor = { connect: { id: data.supervisorId } };
    }

    // Tratar responsáveis: criar apenas se houver IDs no array
    let responsaveisData: { create: { usuarioId: number }[] } | undefined = undefined;
    if (data.responsavelIds && Array.isArray(data.responsavelIds) && data.responsavelIds.length > 0) {
      responsaveisData = { create: data.responsavelIds.map((usuarioId) => ({ usuarioId })) };
    }

    return this.prisma.projeto.create({
      data: {
        ...payload,
        responsaveis: responsaveisData,
      },
      include: {
        supervisor: { include: { cargo: true } },
        responsaveis: { include: { usuario: { include: { cargo: true } } } },
      },
    });
  }

  async update(id: number, data: UpdateProjectDto) {
    // Buscar projeto atual para comparar status
    const projetoAtual = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
      },
    });

    if (!projetoAtual) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const statusAnterior = projetoAtual.status;
    const novoStatus = data.status;

    // Preparar payload para o Prisma
    const payload: any = {
      nome: data.nome,
      resumo: data.resumo,
      objetivo: data.objetivo,
      valorTotal: data.valorTotal,
      // valorInsumos não é mais editável, será calculado automaticamente
      status: data.status,
      planilhaJson: data.planilhaJson,
    };

    // Tratar supervisor (relação) - não pode ser removido, apenas alterado
    if (data.supervisorId !== undefined) {
      if (data.supervisorId === null || data.supervisorId === 0) {
        throw new BadRequestException('Supervisor é obrigatório e não pode ser removido');
      }
        const supervisorExists = await this.prisma.usuario.findUnique({ where: { id: data.supervisorId } });
        if (!supervisorExists) {
          throw new BadRequestException('Supervisor informado não existe');
        }
        payload.supervisor = { connect: { id: data.supervisorId } };
    }

    // Remover campos undefined do payload
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const projetoAtualizado = await this.prisma.projeto.update({
      where: { id },
      data: payload,
      include: {
        supervisor: { include: { cargo: true } },
        responsaveis: { include: { usuario: { include: { cargo: true } } } },
      },
    });

    // Se o status mudou para FINALIZADO (aprovado), criar notificações e requerimentos
    if (novoStatus && novoStatus !== statusAnterior && novoStatus === ProjetoStatus.FINALIZADO) {
      await this.notificarAprovacaoReprovacao(projetoAtualizado, novoStatus);
    }

    return projetoAtualizado;
  }

  private async notificarAprovacaoReprovacao(projeto: any, status: ProjetoStatus) {
    // FINALIZADO é considerado como aprovado
    const isAprovado = status === ProjetoStatus.FINALIZADO;
    const usuariosParaNotificar: number[] = [];

    // Adicionar supervisor se existir
    if (projeto.supervisor && projeto.supervisor.id) {
      usuariosParaNotificar.push(projeto.supervisor.id);
    }

    // Adicionar responsáveis
    if (projeto.responsaveis && Array.isArray(projeto.responsaveis)) {
      projeto.responsaveis.forEach((responsavel: any) => {
        if (responsavel.usuario && responsavel.usuario.id && !usuariosParaNotificar.includes(responsavel.usuario.id)) {
          usuariosParaNotificar.push(responsavel.usuario.id);
        }
      });
    }

    // Buscar um usuário DIRETOR ou GM para ser o remetente do requerimento (sistema)
    const cargoDiretor = await this.prisma.cargo.findFirst({
      where: {
        OR: [{ nome: 'DIRETOR' }, { nome: 'GM' }],
        ativo: true,
      },
    });

    let remetenteSistemaId: number | null = null;
    if (cargoDiretor) {
      const usuarioDiretor = await this.prisma.usuario.findFirst({
        where: {
          cargoId: cargoDiretor.id,
          ativo: true,
        },
      });
      if (usuarioDiretor) {
        remetenteSistemaId = usuarioDiretor.id;
      }
    }

    // Se não encontrar diretor, usar o primeiro usuário ativo (fallback)
    if (!remetenteSistemaId) {
      const usuarioFallback = await this.prisma.usuario.findFirst({
        where: { ativo: true },
        orderBy: { id: 'asc' },
      });
      if (usuarioFallback) {
        remetenteSistemaId = usuarioFallback.id;
      }
    }

    // Se ainda não houver remetente, não criar requerimentos (mas criar notificações)
    if (!remetenteSistemaId) {
      console.warn('Não foi possível encontrar um remetente para os requerimentos de aprovação/reprovação de projeto');
    }

    const statusLabel = isAprovado ? 'finalizado' : 'alterado';
    const titulo = `Projeto ${statusLabel}`;
    const mensagem = `O projeto "${projeto.nome}" foi ${statusLabel}.`;

    // Criar notificações e requerimentos para cada usuário
    for (const usuarioId of usuariosParaNotificar) {
      // Criar notificação
      await this.prisma.notificacao.create({
        data: {
          usuarioId,
          titulo,
          mensagem,
          tipo: NotificacaoTipo.INFO, // Sempre usar INFO ao invés de SUCCESS/WARNING
        },
      });

      // Criar requerimento do tipo INFORMACAO (sistema envia para o solicitante)
      // Só criar se o usuário estiver relacionado ao projeto (supervisor ou responsável)
      if (remetenteSistemaId) {
        try {
          const requerimento = await this.prisma.requerimento.create({
            data: {
              usuarioId: remetenteSistemaId, // Remetente: sistema (diretor/GM)
              destinatarioId: usuarioId, // Destinatário: solicitante
              tipo: RequerimentoTipo.INFORMACAO,
              texto: `O projeto "${projeto.nome}" foi ${statusLabel}.`,
              etapaId: null, // Não associar a etapa específica
            },
          });
          console.log(`Requerimento criado com sucesso: ID=${requerimento.id}, destinatarioId=${usuarioId}, remetenteId=${remetenteSistemaId}`);
        } catch (error) {
          console.error(`Erro ao criar requerimento para usuário ${usuarioId}:`, error);
        }
      } else {
        console.warn(`Não foi possível criar requerimento para usuário ${usuarioId}: remetenteSistemaId é null`);
      }
    }
  }

  async updateResponsibles(id: number, data: UpdateResponsiblesDto) {
    await this.findOne(id);

    // Normalizar: se não foi fornecido, usar array vazio
    const responsavelIds = data.responsavelIds || [];

    // Validar que todos os IDs são válidos se o array não estiver vazio
    if (responsavelIds.length > 0) {
      for (const usuarioId of responsavelIds) {
        if (!Number.isInteger(usuarioId) || usuarioId < 1) {
          throw new BadRequestException(`ID de usuário inválido: ${usuarioId}`);
        }
        // Verificar se o usuário existe
        const user = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
        if (!user) {
          throw new NotFoundException(`Usuário com ID ${usuarioId} não encontrado`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Sempre deletar todos os responsáveis existentes
      await tx.projetoResponsavel.deleteMany({ where: { projetoId: id } });

      // Se houver responsáveis para adicionar, criar os novos registros
      if (responsavelIds.length > 0) {
        const records = responsavelIds.map((usuarioId) => ({ projetoId: id, usuarioId }));
      await tx.projetoResponsavel.createMany({ data: records });
      }

      return tx.projeto.findUnique({
        where: { id },
        include: { 
          supervisor: { include: { cargo: true } },
          responsaveis: { include: { usuario: { include: { cargo: true } } } } 
        },
      });
    });
  }

  async finalize(id: number) {
    const projetoAtual = await this.findOne(id);
    
    const projetoAtualizado = await this.prisma.projeto.update({
      where: { id },
      data: { status: ProjetoStatus.FINALIZADO, dataFinalizacao: new Date() },
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
      },
    });

    // Se o status mudou para FINALIZADO, criar notificações e requerimentos
    if (projetoAtual.status !== ProjetoStatus.FINALIZADO) {
      await this.notificarAprovacaoReprovacao(projetoAtualizado, ProjetoStatus.FINALIZADO);
    }

    return projetoAtualizado;
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.projeto.delete({ where: { id } });
  }
}
