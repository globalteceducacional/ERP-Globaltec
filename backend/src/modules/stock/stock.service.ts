import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
import { CompraStatus, EstoqueStatus, NotificacaoTipo } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listItems(filter: { search?: string }) {
    const where: any = {};

    if (filter.search) {
      where.item = { 
        contains: filter.search,
        mode: 'insensitive' as any, // Prisma PostgreSQL suporta insensitive
      };
    }

    const items = await this.prisma.estoque.findMany({
      where,
      include: { 
        projeto: true, 
        etapa: true,
        categoria: true,
      } as any,
      orderBy: { item: 'asc' },
    });

    // Buscar alocações para todos os itens
    const itemIds = items.map(item => item.id);
    const alocacoes = itemIds.length > 0 ? await (this.prisma as any).estoqueAlocacao.findMany({
      where: { estoqueId: { in: itemIds } },
      include: {
        projeto: true,
        etapa: true,
      },
    }) : [];

    // Calcular quantidade disponível e alocada para cada item
    return items.map((item) => {
      const itemAlocacoes = alocacoes.filter(aloc => aloc.estoqueId === item.id);
      const quantidadeAlocada = itemAlocacoes.reduce((sum, aloc) => sum + aloc.quantidade, 0);
      const quantidadeDisponivel = item.quantidade - quantidadeAlocada;
      
      return {
        ...item,
        quantidadeAlocada,
        quantidadeDisponivel,
        alocacoes: itemAlocacoes,
      };
    });
  }

  async createItem(data: CreateStockItemDto) {
    const createData: any = {
      item: data.item,
      quantidade: data.quantidade,
      valorUnitario: data.valorUnitario,
      status: EstoqueStatus.DISPONIVEL, // Status padrão
    };

    // Adicionar campos opcionais apenas se existirem
    if (data.descricao !== undefined && data.descricao !== null) {
      createData.descricao = data.descricao;
    }
    if (data.imagemUrl !== undefined && data.imagemUrl !== null) {
      createData.imagemUrl = data.imagemUrl;
    }
    if (data.cotacoes) {
      createData.cotacoesJson = data.cotacoes as any;
    }
    if (data.categoriaId) {
      createData.categoriaId = data.categoriaId;
    }

    // Criar o item (alocações são feitas separadamente através do modal de alocações)
    return this.prisma.estoque.create({
      data: createData,
    });
  }

  async updateItem(id: number, data: UpdateStockItemDto) {
    await this.ensureItemExists(id);

    const updateData: any = {};
    
    if (data.item !== undefined) {
      updateData.item = data.item;
    }
    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao;
    }
    if (data.quantidade !== undefined) {
      // Validar que a nova quantidade não seja menor que a quantidade já alocada
      const alocacoesExistentes = await (this.prisma as any).estoqueAlocacao.findMany({
        where: { estoqueId: id },
      });
      const quantidadeAlocada = alocacoesExistentes.reduce((sum: number, aloc: any) => sum + aloc.quantidade, 0);
      
      if (data.quantidade < quantidadeAlocada) {
        throw new BadRequestException(
          `A quantidade não pode ser menor que a quantidade já alocada (${quantidadeAlocada})`
        );
      }
      
      updateData.quantidade = data.quantidade;
    }
    if (data.valorUnitario !== undefined) {
      updateData.valorUnitario = data.valorUnitario;
    }
    if (data.imagemUrl !== undefined) {
      updateData.imagemUrl = data.imagemUrl;
    }
    if (data.cotacoes !== undefined) {
      // Converter cotacoes para cotacoesJson (formato do Prisma)
      if (Array.isArray(data.cotacoes) && data.cotacoes.length > 0) {
        updateData.cotacoesJson = data.cotacoes as any;
      } else if (data.cotacoes === null || (Array.isArray(data.cotacoes) && data.cotacoes.length === 0)) {
        // Permitir limpar cotações
        updateData.cotacoesJson = null;
      }
    }
    if (data.categoriaId !== undefined) {
      updateData.categoriaId = data.categoriaId || null;
    }

    return this.prisma.estoque.update({ where: { id }, data: updateData });
  }

  async deleteItem(id: number) {
    await this.ensureItemExists(id);
    await this.prisma.estoque.delete({ where: { id } });
    return { deleted: true };
  }

  async listPurchases(filter: { status?: CompraStatus; projetoId?: number; etapaId?: number; excludeSolicitado?: boolean }) {
    const where: any = {};

    if (filter.status) {
      where.status = filter.status;
    }

    // Se excludeSolicitado for true, excluir compras com status SOLICITADO
    if (filter.excludeSolicitado) {
      if (where.status) {
        // Se já tem filtro de status, combinar com AND
        where.AND = where.AND || [];
        where.AND.push({ status: { not: 'SOLICITADO' as any } });
        delete where.status;
      } else {
        where.status = { not: 'SOLICITADO' as any };
      }
    }

    // Se projetoId for fornecido, incluir compras do projeto OU compras sem projeto
    if (filter.projetoId) {
      if (where.AND) {
        where.AND.push({
          OR: [
            { projetoId: filter.projetoId },
            { projetoId: null },
          ],
        });
      } else {
        where.AND = [
          {
            OR: [
              { projetoId: filter.projetoId },
              { projetoId: null },
            ],
          },
        ];
      }
    }

    if (filter.etapaId) {
      // Se etapaId for fornecido, só mostrar compras sem etapa ou da etapa especificada
      if (where.AND) {
        where.AND.push({
          OR: [
            { etapaId: filter.etapaId },
            { etapaId: null },
          ],
        });
      } else {
        where.AND = [
          {
            OR: [
              { etapaId: filter.etapaId },
              { etapaId: null },
            ],
          },
        ];
      }
    }

    return this.prisma.compra.findMany({
      where,
      include: { 
        projeto: true, 
        etapa: true,
        solicitadoPor: { include: { cargo: true } },
        categoria: true,
      } as any,
      orderBy: { dataSolicitacao: 'desc' },
    });
  }

  async createPurchase(data: CreatePurchaseDto, solicitadoPorId?: number) {
    if (data.projetoId) {
    await this.ensureProjectExists(data.projetoId);
    }
    
    if (data.etapaId) {
      await this.ensureTaskExists(data.etapaId);
    }

    // Se não houver cotação, definir status como SOLICITADO
    const hasCotacoes = data.cotacoes && data.cotacoes.length > 0;
    const status = data.status ?? (hasCotacoes ? CompraStatus.PENDENTE : ('SOLICITADO' as CompraStatus));

    const createData: any = {
      projetoId: data.projetoId || null,
      item: data.item,
      quantidade: data.quantidade,
      valorUnitario: data.valorUnitario || null,
      status: status,
    };

    // Adicionar solicitadoPorId se fornecido
    if (solicitadoPorId) {
      createData.solicitadoPorId = solicitadoPorId;
    }

    if (data.etapaId) {
      createData.etapaId = data.etapaId;
    }

    // Adicionar campos opcionais apenas se existirem
    if (data.descricao !== undefined && data.descricao !== null && data.descricao.trim().length > 0) {
      createData.descricao = data.descricao;
    }
    // Salvar imagemUrl se existir e não for vazia
    if (data.imagemUrl !== undefined && data.imagemUrl !== null && typeof data.imagemUrl === 'string' && data.imagemUrl.trim().length > 0) {
      createData.imagemUrl = data.imagemUrl;
      console.log('[createPurchase] imagemUrl salva:', data.imagemUrl.substring(0, 50) + '...', `(${data.imagemUrl.length} chars)`);
    } else {
      console.log('[createPurchase] imagemUrl não incluída:', { 
        undefined: data.imagemUrl === undefined, 
        null: data.imagemUrl === null, 
        type: typeof data.imagemUrl,
        length: typeof data.imagemUrl === 'string' ? data.imagemUrl.length : 'N/A'
      });
    }
    if (data.nfUrl !== undefined && data.nfUrl !== null && data.nfUrl.trim().length > 0) {
      createData.nfUrl = data.nfUrl;
    }
    if (data.comprovantePagamentoUrl !== undefined && data.comprovantePagamentoUrl !== null && data.comprovantePagamentoUrl.trim().length > 0) {
      createData.comprovantePagamentoUrl = data.comprovantePagamentoUrl;
    }
    if (data.cotacoes) {
      createData.cotacoesJson = data.cotacoes as any;
    }
    if (data.dataCompra) {
      createData.dataCompra = new Date(data.dataCompra);
    }
    if (data.categoriaId) {
      createData.categoriaId = data.categoriaId;
    }
    if (data.observacao && data.observacao.trim().length > 0) {
      createData.observacao = data.observacao.trim();
    }

    console.log('[createPurchase] createData antes de salvar:', {
      ...createData,
      imagemUrl: createData.imagemUrl ? `${createData.imagemUrl.substring(0, 50)}... (${createData.imagemUrl.length} chars)` : 'não incluído'
    });

    const created = await this.prisma.compra.create({
      data: createData,
    });

    console.log('[createPurchase] Compra criada:', {
      id: created.id,
      item: created.item,
      imagemUrl: created.imagemUrl ? `${created.imagemUrl.substring(0, 50)}... (${created.imagemUrl.length} chars)` : 'null'
    });

    return created;
  }

  async updatePurchaseStatus(id: number, data: UpdatePurchaseStatusDto) {
    await this.ensurePurchaseExists(id);

    const updateData: any = {
      status: data.status,
    };

    if (data.status === CompraStatus.COMPRADO_ACAMINHO || data.status === CompraStatus.ENTREGUE) {
      updateData.dataConfirmacao = new Date();
    }

    // Incluir statusEntrega se fornecido e status for COMPRADO_ACAMINHO
    if (data.statusEntrega !== undefined) {
      updateData.statusEntrega = data.statusEntrega;
    }
    
    // Previsão de entrega (quando status for COMPRADO_ACAMINHO)
    if (data.previsaoEntrega !== undefined) {
      updateData.previsaoEntrega = data.previsaoEntrega ? new Date(data.previsaoEntrega) : null;
    }
    
    // Campos de entrega
    if (data.dataEntrega !== undefined) {
      updateData.dataEntrega = data.dataEntrega ? new Date(data.dataEntrega) : null;
    }
    if (data.enderecoEntrega !== undefined) {
      updateData.enderecoEntrega = data.enderecoEntrega || null;
    }
    if (data.recebidoPor !== undefined) {
      updateData.recebidoPor = data.recebidoPor || null;
    }
    if (data.observacao !== undefined) {
      updateData.observacao = data.observacao || null;
    }

    const compra = await this.prisma.compra.update({
      where: { id },
      data: updateData,
    });

    if (data.status === CompraStatus.ENTREGUE) {
      await this.appendToStock({
        projetoId: compra.projetoId,
        etapaId: compra.etapaId,
        item: compra.item,
        descricao: compra.descricao,
        quantidade: compra.quantidade,
        valorUnitario: compra.valorUnitario,
        imagemUrl: compra.imagemUrl,
        cotacoesJson: compra.cotacoesJson,
      });
    }

    return compra;
  }

  async updatePurchase(id: number, data: UpdatePurchaseDto) {
    await this.ensurePurchaseExists(id);

    const updateData: any = {};
    
    if (data.item !== undefined) {
      updateData.item = data.item;
    }
    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao;
    }
    if (data.quantidade !== undefined) {
      updateData.quantidade = data.quantidade;
    }
    if (data.valorUnitario !== undefined) {
      updateData.valorUnitario = data.valorUnitario;
    }
    if (data.imagemUrl !== undefined) {
      updateData.imagemUrl = data.imagemUrl;
    }
    if (data.nfUrl !== undefined) {
      updateData.nfUrl = data.nfUrl;
    }
    if (data.comprovantePagamentoUrl !== undefined) {
      updateData.comprovantePagamentoUrl = data.comprovantePagamentoUrl;
    }
    if (data.cotacoes !== undefined) {
      if (Array.isArray(data.cotacoes) && data.cotacoes.length > 0) {
        updateData.cotacoesJson = data.cotacoes as any;
      } else if (data.cotacoes === null || (Array.isArray(data.cotacoes) && data.cotacoes.length === 0)) {
        updateData.cotacoesJson = null;
      }
    }
    if (data.etapaId !== undefined) {
      if (data.etapaId) {
        await this.ensureTaskExists(data.etapaId);
        updateData.etapaId = data.etapaId;
      } else {
        updateData.etapaId = null;
      }
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === CompraStatus.COMPRADO_ACAMINHO || data.status === CompraStatus.ENTREGUE) {
        updateData.dataConfirmacao = new Date();
      }
    }
    if (data.dataCompra !== undefined) {
      updateData.dataCompra = data.dataCompra ? new Date(data.dataCompra) : null;
    }
    if (data.categoriaId !== undefined) {
      updateData.categoriaId = data.categoriaId || null;
    }
    if (data.statusEntrega !== undefined) {
      updateData.statusEntrega = data.statusEntrega || null;
    }
    if (data.dataEntrega !== undefined) {
      updateData.dataEntrega = data.dataEntrega ? new Date(data.dataEntrega) : null;
    }
    if (data.enderecoEntrega !== undefined) {
      updateData.enderecoEntrega = data.enderecoEntrega || null;
    }
    if (data.recebidoPor !== undefined) {
      updateData.recebidoPor = data.recebidoPor || null;
    }
    if (data.observacao !== undefined) {
      updateData.observacao = data.observacao || null;
    }

    // Atualizar a compra primeiro para garantir que todos os dados estejam atualizados
    const compraAtualizada = await this.prisma.compra.update({ where: { id }, data: updateData });

    // Se o status foi alterado para ENTREGUE, transferir para o estoque
      if (data.status === CompraStatus.ENTREGUE) {
      await this.appendToStock({
        projetoId: compraAtualizada.projetoId,
        etapaId: compraAtualizada.etapaId,
        item: compraAtualizada.item,
        descricao: compraAtualizada.descricao,
        quantidade: compraAtualizada.quantidade,
        valorUnitario: compraAtualizada.valorUnitario,
        imagemUrl: compraAtualizada.imagemUrl,
        cotacoesJson: compraAtualizada.cotacoesJson,
      });
    }

    return compraAtualizada;
  }

  async deletePurchase(id: number) {
    await this.ensurePurchaseExists(id);
    await this.prisma.compra.delete({ where: { id } });
    return { deleted: true };
  }

  private async appendToStock(compra: { 
    projetoId?: number | null; 
    etapaId?: number | null; 
    item: string; 
    descricao?: string | null;
    quantidade: number; 
    valorUnitario?: number | null;
    imagemUrl?: string | null;
    cotacoesJson?: any;
  }) {
    console.log('[appendToStock] Iniciando transferência para estoque:', {
      item: compra.item,
      projetoId: compra.projetoId,
      etapaId: compra.etapaId,
      imagemUrl: compra.imagemUrl ? `${compra.imagemUrl.substring(0, 50)}... (${compra.imagemUrl.length} chars)` : 'null/undefined',
      imagemUrlType: typeof compra.imagemUrl,
      imagemUrlLength: compra.imagemUrl ? compra.imagemUrl.length : 0
    });

    const existing = await this.prisma.estoque.findFirst({
      where: { 
        item: compra.item, 
        projetoId: compra.projetoId || null,
        etapaId: compra.etapaId || null,
      },
    });

    if (existing) {
      const imagemUrlFinal = compra.imagemUrl && compra.imagemUrl.trim().length > 0 
        ? compra.imagemUrl 
        : existing.imagemUrl;
      
      console.log('[appendToStock] Item existente encontrado. Atualizando:', {
        existingId: existing.id,
        imagemUrlExistente: existing.imagemUrl ? `${existing.imagemUrl.substring(0, 50)}... (${existing.imagemUrl.length} chars)` : 'null',
        imagemUrlCompra: compra.imagemUrl ? `${compra.imagemUrl.substring(0, 50)}... (${compra.imagemUrl.length} chars)` : 'null',
        imagemUrlFinal: imagemUrlFinal ? `${imagemUrlFinal.substring(0, 50)}... (${imagemUrlFinal.length} chars)` : 'null'
      });

      await this.prisma.estoque.update({
        where: { id: existing.id },
        data: {
          quantidade: existing.quantidade + compra.quantidade,
          valorUnitario: compra.valorUnitario ?? existing.valorUnitario,
          // Priorizar imagem da compra se existir, senão manter a existente
          imagemUrl: imagemUrlFinal,
          // Priorizar descrição da compra se existir, senão manter a existente
          descricao: compra.descricao && compra.descricao.trim().length > 0 
            ? compra.descricao 
            : existing.descricao,
          // Priorizar cotações da compra se existir, senão manter as existentes
          cotacoesJson: compra.cotacoesJson || existing.cotacoesJson,
        },
      });

      console.log('[appendToStock] Item atualizado com sucesso');
    } else {
      const imagemUrlFinal = compra.imagemUrl && compra.imagemUrl.trim().length > 0 ? compra.imagemUrl : null;
      
      console.log('[appendToStock] Criando novo item no estoque:', {
        imagemUrlFinal: imagemUrlFinal ? `${imagemUrlFinal.substring(0, 50)}... (${imagemUrlFinal.length} chars)` : 'null'
      });

      await this.prisma.estoque.create({
        data: {
          item: compra.item,
          descricao: compra.descricao && compra.descricao.trim().length > 0 ? compra.descricao : null,
          quantidade: compra.quantidade,
          valorUnitario: compra.valorUnitario ?? 0,
          imagemUrl: imagemUrlFinal,
          cotacoesJson: compra.cotacoesJson || null,
          status: EstoqueStatus.DISPONIVEL,
          projetoId: compra.projetoId || null,
          etapaId: compra.etapaId || null,
        },
      });

      console.log('[appendToStock] Novo item criado com sucesso');
    }
  }

  private async ensureProjectExists(id: number) {
    const project = await this.prisma.projeto.findUnique({ where: { id } });
    if (!project) {
      throw new BadRequestException('Projeto informado não existe');
    }
  }

  private async ensureTaskExists(id: number) {
    const task = await this.prisma.etapa.findUnique({ where: { id } });
    if (!task) {
      throw new BadRequestException('Etapa informada não existe');
    }
  }

  private async ensureUserExists(id: number) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('Usuário informado não existe');
    }
  }

  private async ensureItemExists(id: number) {
    const item = await this.prisma.estoque.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado');
    }
    return item;
  }

  private async ensurePurchaseExists(id: number) {
    const compra = await this.prisma.compra.findUnique({ where: { id } });
    if (!compra) {
      throw new NotFoundException('Compra não encontrada');
    }
    return compra;
  }

  async approvePurchase(id: number, data: { cotacoes?: any[]; selectedCotacaoIndex?: number }) {
    const compra = await this.ensurePurchaseExists(id);
    
    if (compra.status !== ('SOLICITADO' as CompraStatus)) {
      throw new BadRequestException('Apenas solicitações podem ser aprovadas');
    }

    let valorUnitario = compra.valorUnitario;
    let cotacoesJson = compra.cotacoesJson;

    // Se houver cotações fornecidas, usar a selecionada
    if (data.cotacoes && data.cotacoes.length > 0) {
      const selectedIndex = data.selectedCotacaoIndex ?? 0;
      const selectedCotacao = data.cotacoes[selectedIndex];
      if (selectedCotacao) {
        valorUnitario = selectedCotacao.valorUnitario + selectedCotacao.frete + selectedCotacao.impostos;
        cotacoesJson = data.cotacoes as any;
      }
    }

    if (!valorUnitario || valorUnitario <= 0) {
      throw new BadRequestException('É necessário fornecer cotações ou valor unitário para aprovar a solicitação');
    }

    return this.prisma.compra.update({
      where: { id },
      data: {
        status: CompraStatus.PENDENTE,
        valorUnitario: valorUnitario,
        cotacoesJson: cotacoesJson as any,
      },
      include: {
        projeto: true,
        etapa: true,
        solicitadoPor: { include: { cargo: true } },
        categoria: true,
      } as any,
    });
  }

  async rejectPurchase(id: number, motivoRejeicao: string) {
    const compra = await this.ensurePurchaseExists(id);
    
    if (compra.status !== ('SOLICITADO' as CompraStatus)) {
      throw new BadRequestException('Apenas solicitações podem ser reprovadas');
    }

    const compraReprovada = await this.prisma.compra.update({
      where: { id },
      data: {
        status: 'REPROVADO' as CompraStatus,
        motivoRejeicao: motivoRejeicao.trim(),
      } as any,
      include: {
        projeto: true,
        etapa: true,
        solicitadoPor: { include: { cargo: true } },
        categoria: true,
      } as any,
    });

    // Criar notificação para o solicitante e supervisor do projeto
    if ((compraReprovada as any).solicitadoPorId) {
      await this.notificationsService.create({
        usuarioId: (compraReprovada as any).solicitadoPorId,
        titulo: 'Solicitação de Compra Reprovada',
        mensagem: `Sua solicitação de compra "${compraReprovada.item}" foi reprovada. Motivo: ${motivoRejeicao.trim()}`,
        tipo: NotificacaoTipo.ERROR,
      });
    }

    // Notificar supervisor do projeto se houver
    if ((compraReprovada as any).projeto?.supervisorId) {
      await this.notificationsService.create({
        usuarioId: (compraReprovada as any).projeto.supervisorId,
        titulo: 'Solicitação de Compra Reprovada',
        mensagem: `A solicitação de compra "${compraReprovada.item}" do projeto "${(compraReprovada as any).projeto.nome}" foi reprovada. Motivo: ${motivoRejeicao.trim()}`,
        tipo: NotificacaoTipo.WARNING,
      });
    }

    return compraReprovada;
  }

  async createAlocacao(data: { estoqueId: number; projetoId?: number; etapaId?: number; usuarioId?: number; quantidade: number }) {
    const item = await this.ensureItemExists(data.estoqueId);
    
    // Validar que pelo menos um (projeto/etapa ou usuário) seja fornecido
    if (!data.projetoId && !data.usuarioId) {
      throw new BadRequestException('É necessário informar um projeto ou um usuário para alocar o item');
    }
    
    // Verificar quantidade disponível
    const alocacoesExistentes = await (this.prisma as any).estoqueAlocacao.findMany({
      where: { estoqueId: data.estoqueId },
    });
    const quantidadeAlocada = alocacoesExistentes.reduce((sum: number, aloc: any) => sum + aloc.quantidade, 0);
    const quantidadeDisponivel = item.quantidade - quantidadeAlocada;
    
    if (data.quantidade > quantidadeDisponivel) {
      throw new BadRequestException(
        `Quantidade solicitada (${data.quantidade}) excede a quantidade disponível (${quantidadeDisponivel})`
      );
    }

    if (data.projetoId) {
      await this.ensureProjectExists(data.projetoId);
    }
    if (data.etapaId) {
      await this.ensureTaskExists(data.etapaId);
    }
    if (data.usuarioId) {
      await this.ensureUserExists(data.usuarioId);
    }

    // Verificar se já existe alocação para este estoque+projeto+etapa+usuario
    const alocacaoExistente = await (this.prisma as any).estoqueAlocacao.findFirst({
      where: {
        estoqueId: data.estoqueId,
        projetoId: data.projetoId || null,
        etapaId: data.etapaId || null,
        usuarioId: data.usuarioId || null,
      },
    });

    if (alocacaoExistente) {
      // Atualizar alocação existente
      const novaQuantidade = alocacaoExistente.quantidade + data.quantidade;
      if (novaQuantidade > quantidadeDisponivel + alocacaoExistente.quantidade) {
        throw new BadRequestException(
          `Quantidade total (${novaQuantidade}) excede a quantidade disponível (${quantidadeDisponivel + alocacaoExistente.quantidade})`
        );
      }
      return (this.prisma as any).estoqueAlocacao.update({
        where: { id: alocacaoExistente.id },
        data: { quantidade: novaQuantidade },
        include: {
          estoque: true,
          projeto: true,
          etapa: true,
          usuario: {
            select: {
              id: true,
              nome: true,
              cargo: {
                select: {
                  nome: true,
                },
              },
            },
          },
        },
      });
    }

    return (this.prisma as any).estoqueAlocacao.create({
      data: {
        estoqueId: data.estoqueId,
        projetoId: data.projetoId || null,
        etapaId: data.etapaId || null,
        usuarioId: data.usuarioId || null,
        quantidade: data.quantidade,
      },
      include: {
        estoque: true,
        projeto: true,
        etapa: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            cargo: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });
  }

  async updateAlocacao(id: number, quantidade: number) {
    const alocacao = await (this.prisma as any).estoqueAlocacao.findUnique({
      where: { id },
      include: { estoque: true },
    });

    if (!alocacao) {
      throw new NotFoundException('Alocação não encontrada');
    }

    // Verificar quantidade disponível
    const alocacoesExistentes = await (this.prisma as any).estoqueAlocacao.findMany({
      where: { estoqueId: alocacao.estoqueId },
    });
    const quantidadeAlocada = alocacoesExistentes.reduce((sum: number, aloc: any) => {
      if (aloc.id === id) return sum; // Excluir a alocação atual
      return sum + aloc.quantidade;
    }, 0);
    const quantidadeDisponivel = alocacao.estoque.quantidade - quantidadeAlocada;
    
    if (quantidade > quantidadeDisponivel) {
      throw new BadRequestException(
        `Quantidade solicitada (${quantidade}) excede a quantidade disponível (${quantidadeDisponivel})`
      );
    }

    return (this.prisma as any).estoqueAlocacao.update({
      where: { id },
      data: { quantidade },
      include: {
        estoque: true,
        projeto: true,
        etapa: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            cargo: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteAlocacao(id: number) {
    await (this.prisma as any).estoqueAlocacao.delete({ where: { id } });
    return { deleted: true };
  }

  async listAlocacoes(estoqueId?: number, projetoId?: number, etapaId?: number, usuarioId?: number) {
    const where: any = {};
    if (estoqueId) where.estoqueId = estoqueId;
    if (projetoId) where.projetoId = projetoId;
    if (etapaId) where.etapaId = etapaId;
    if (usuarioId) where.usuarioId = usuarioId;

    return (this.prisma as any).estoqueAlocacao.findMany({
      where,
      include: {
        estoque: true,
        projeto: true,
        etapa: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            cargo: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
      orderBy: { dataAlocacao: 'desc' },
    });
  }
}
