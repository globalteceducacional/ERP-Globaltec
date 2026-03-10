import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateResponsiblesDto } from './dto/update-responsibles.dto';
import { ReorderEtapasDto } from './dto/reorder-etapas.dto';
import { DeleteAbaDto, RenameAbaDto } from './dto/update-aba.dto';
import { CreateSessaoDto } from './dto/create-sessao.dto';
import { UpdateSessaoDto } from './dto/update-sessao.dto';
import { EtapaStatus, ProjetoStatus, NotificacaoTipo, RequerimentoTipo, Prisma } from '@prisma/client';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOptions() {
    return this.prisma.projeto.findMany({
      select: {
        id: true,
        nome: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

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
          orderBy: { ordem: 'asc' } as any,
          select: {
            id: true,
            status: true,
            valorInsumos: true,
          },
        },
      },
    });

    // Atualizar status do projeto no banco se necessário e calcular progresso
    const updatedProjects = await Promise.all(
      projects.map(async (row) => {
        const { etapas, ...project } = row as typeof row & { etapas: Array<{ id: number; status: string; valorInsumos: number }> };
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
        sessoes: { orderBy: { ordem: 'asc' } },
        etapas: {
          orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
          include: {
            sessao: true,
            executor: true,
            responsavel: true,
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
      } as Prisma.ProjetoInclude,
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
    const nomeTrim = data.nome?.trim();
    if (!nomeTrim) {
      throw new BadRequestException('Nome do projeto é obrigatório');
    }
    const existente = await this.prisma.projeto.findFirst({
      where: { nome: nomeTrim },
      select: { id: true },
    });
    if (existente) {
      throw new BadRequestException(`Já existe um projeto com o nome "${nomeTrim}". Projetos não podem ter o mesmo nome.`);
    }

    const payload: any = {
      nome: nomeTrim,
      resumo: data.resumo,
      objetivo: data.objetivo,
      descricaoLonga: data.descricaoLonga,
      descricaoArquivos: data.descricaoArquivos ?? null,
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

    const projeto = await this.prisma.projeto.create({
      data: {
        ...payload,
        responsaveis: responsaveisData,
      },
      include: {
        supervisor: { include: { cargo: true } },
        responsaveis: { include: { usuario: { include: { cargo: true } } } },
      },
    });

    // Criar sessão e "aba" padrão (Geral) para novos projetos — não aplicar na importação
    await this.prisma.sessao.create({
      data: { projetoId: projeto.id, nome: 'Geral', ordem: 0 },
    });

    return this.findOne(projeto.id);
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

    // Preparar payload para o Prisma (campos básicos do projeto)
    const payload: any = {
      nome: data.nome,
      resumo: data.resumo,
      objetivo: data.objetivo,
      descricaoLonga: data.descricaoLonga,
      // descricaoArquivos agora é gerenciado pelos métodos específicos
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

    if (payload.nome !== undefined && payload.nome !== projetoAtual.nome) {
      const nomeTrim = String(payload.nome).trim();
      const outro = await this.prisma.projeto.findFirst({
        where: { nome: nomeTrim, id: { not: id } },
        select: { id: true },
      });
      if (outro) {
        throw new BadRequestException(`Já existe um projeto com o nome "${nomeTrim}". Projetos não podem ter o mesmo nome.`);
      }
      payload.nome = nomeTrim;
    }

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

  /** Reordena as etapas do projeto conforme o array etapaIds (índice = ordem). */
  async reorderEtapas(projetoId: number, dto: ReorderEtapasDto) {
    await this.findOne(projetoId);

    const etapasDoProjeto = (await this.prisma.etapa.findMany({
      where: { projetoId },
      select: { id: true, ordem: true } as any,
    })) as unknown as { id: number; ordem: number }[];
    const idsExistentes = new Set<number>(etapasDoProjeto.map((e) => e.id));

    const idsRecebidos = dto.etapaIds.filter((id) => idsExistentes.has(id));
    if (idsRecebidos.length !== idsExistentes.size) {
      throw new BadRequestException(
        'A lista de etapas deve conter exatamente os IDs das etapas deste projeto, na nova ordem.',
      );
    }

    await this.prisma.$transaction(
      idsRecebidos.map((etapaId, index) =>
        this.prisma.etapa.update({
          where: { id: etapaId },
          data: { ordem: index } as any,
        }),
      ),
    );

    return this.findOne(projetoId);
  }

  async renameAba(projetoId: number, dto: RenameAbaDto) {
    const from = dto.from?.trim();
    const to = dto.to?.trim();

    if (!from || !to) {
      throw new BadRequestException('Nome atual e novo nome da aba são obrigatórios.');
    }

    await this.findOne(projetoId);

    await this.prisma.etapa.updateMany({
      where: {
        projetoId,
      } as any,
      data: {
        aba: to,
      } as any,
    } as any);

    return this.findOne(projetoId);
  }

  async deleteAba(projetoId: number, dto: DeleteAbaDto) {
    const name = dto.name?.trim();

    if (!name) {
      throw new BadRequestException('Nome da aba é obrigatório para exclusão.');
    }

    await this.findOne(projetoId);

    // Remover a aba das etapas deste projeto, movendo-as para "sem aba" (Geral)
    await this.prisma.etapa.updateMany({
      where: {
        projetoId,
      } as any,
      data: {
        aba: null,
      } as any,
    } as any);

    return this.findOne(projetoId);
  }

  async createSessao(projetoId: number, dto: CreateSessaoDto) {
    await this.findOne(projetoId);
    const nome = dto.nome?.trim();
    if (!nome || nome.length < 2) {
      throw new BadRequestException('Nome da sessão deve ter pelo menos 2 caracteres.');
    }
    const ordem = dto.ordem ?? 0;
    return this.prisma.sessao.create({
      data: { projetoId, nome, ordem },
    });
  }

  async updateSessao(projetoId: number, sessaoId: number, dto: UpdateSessaoDto) {
    await this.findOne(projetoId);
    const sessao = await this.prisma.sessao.findFirst({
      where: { id: sessaoId, projetoId },
    });
    if (!sessao) {
      throw new NotFoundException('Sessão não encontrada neste projeto.');
    }
    const data: { nome?: string; ordem?: number } = {};
    if (dto.nome !== undefined) {
      const nome = String(dto.nome).trim();
      if (nome.length < 2) throw new BadRequestException('Nome da sessão deve ter pelo menos 2 caracteres.');
      data.nome = nome;
    }
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (Object.keys(data).length === 0) return sessao;
    return this.prisma.sessao.update({
      where: { id: sessaoId },
      data,
    });
  }

  async deleteSessao(projetoId: number, sessaoId: number) {
    await this.findOne(projetoId);
    const sessao = await this.prisma.sessao.findFirst({
      where: { id: sessaoId, projetoId },
    });
    if (!sessao) {
      throw new NotFoundException('Sessão não encontrada neste projeto.');
    }
    // Desvincular etapas da sessão (SET NULL) e depois excluir a sessão
    await this.prisma.etapa.updateMany({
      where: { sessaoId },
      data: { sessaoId: null },
    });
    await this.prisma.sessao.delete({ where: { id: sessaoId } });
  }

  /**
   * Adiciona arquivos à descrição do projeto, salvando no campo descricaoArquivos
   * e retornando a lista completa atualizada.
   */
  async addDescricaoArquivos(
    projetoId: number,
    files: Express.Multer.File[],
  ): Promise<
    {
      originalName: string;
      url: string;
      mimeType?: string;
      size?: number;
    }[]
  > {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { descricaoArquivos: true },
    });

    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const existentes = Array.isArray(projeto.descricaoArquivos)
      ? (projeto.descricaoArquivos as any[])
      : [];

    const baseUrl = '/uploads/projects';
    const novos = (files || []).map((file) => ({
      originalName: file.originalname,
      url: `${baseUrl}/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
    }));

    const atualizados = [...existentes, ...novos];

    await this.prisma.projeto.update({
      where: { id: projetoId },
      data: { descricaoArquivos: atualizados as any },
    });

    return atualizados;
  }

  /**
   * Remove um arquivo específico da descrição do projeto (por URL)
   * e também apaga o arquivo físico do storage, se existir.
   */
  async removeDescricaoArquivo(
    projetoId: number,
    url: string,
  ): Promise<
    {
      originalName: string;
      url: string;
      mimeType?: string;
      size?: number;
    }[]
  > {
    if (!url) {
      throw new BadRequestException('URL do arquivo é obrigatória');
    }

    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { descricaoArquivos: true },
    });

    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const existentes = Array.isArray(projeto.descricaoArquivos)
      ? (projeto.descricaoArquivos as any[])
      : [];

    const atualizados = existentes.filter(
      (file) => file && typeof file.url === 'string' && file.url !== url,
    );

    await this.prisma.projeto.update({
      where: { id: projetoId },
      data: { descricaoArquivos: atualizados as any },
    });

    await this.deleteProjectFilesFromStorage([url]);

    return atualizados;
  }

  /**
   * Apaga arquivos físicos do diretório de uploads de projetos,
   * usado ao remover anexos da descrição.
   */
  private async deleteProjectFilesFromStorage(urls: string[]): Promise<void> {
    if (!urls || !Array.isArray(urls)) {
      return;
    }

    for (const url of urls) {
      if (!url || typeof url !== 'string') continue;
      if (!url.startsWith('/uploads/projects/')) continue;

      const relativePath = url.replace(/^\/+/, '');
      const absolutePath = join(process.cwd(), relativePath);

      try {
        await fs.promises.stat(absolutePath);
      } catch {
        // Arquivo não existe mais, seguir em frente
        continue;
      }

      try {
        await fs.promises.unlink(absolutePath);
      } catch {
        // Falha ao remover arquivo não deve quebrar a requisição
      }
    }
  }
}
