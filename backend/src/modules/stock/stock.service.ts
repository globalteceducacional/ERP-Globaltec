import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
import { CompraStatus, EstoqueStatus } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(filter: { status?: EstoqueStatus; search?: string }) {
    const where: Record<string, unknown> = {};

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.search) {
      where.item = { 
        contains: filter.search,
        mode: 'insensitive' as any, // Prisma PostgreSQL suporta insensitive
      };
    }

    return this.prisma.estoque.findMany({
      where,
      include: { projeto: true, etapa: true },
      orderBy: { item: 'asc' },
    });
  }

  async createItem(data: CreateStockItemDto) {
    if (data.projetoId) {
      await this.ensureProjectExists(data.projetoId);
    }
    if (data.etapaId) {
      await this.ensureTaskExists(data.etapaId);
    }

    const createData: any = {
      item: data.item,
      quantidade: data.quantidade,
      valorUnitario: data.valorUnitario,
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
    if (data.status) {
      createData.status = data.status;
    }
    if (data.projetoId) {
      createData.projetoId = data.projetoId;
    }
    if (data.etapaId) {
      createData.etapaId = data.etapaId;
    }

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
      updateData.quantidade = data.quantidade;
    }
    if (data.valorUnitario !== undefined) {
      updateData.valorUnitario = data.valorUnitario;
    }
    if (data.imagemUrl !== undefined) {
      updateData.imagemUrl = data.imagemUrl;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
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
    if (data.projetoId !== undefined) {
      if (data.projetoId) {
        await this.ensureProjectExists(data.projetoId);
        updateData.projetoId = data.projetoId;
      } else {
        updateData.projetoId = null;
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

    return this.prisma.estoque.update({ where: { id }, data: updateData });
  }

  async deleteItem(id: number) {
    await this.ensureItemExists(id);
    await this.prisma.estoque.delete({ where: { id } });
    return { deleted: true };
  }

  async listPurchases(filter: { status?: CompraStatus; projetoId?: number }) {
    const where: Record<string, unknown> = {};

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.projetoId) {
      where.projetoId = filter.projetoId;
    }

    return this.prisma.compra.findMany({
      where,
      include: { projeto: true },
      orderBy: { dataSolicitacao: 'desc' },
    });
  }

  async createPurchase(data: CreatePurchaseDto) {
    await this.ensureProjectExists(data.projetoId);

    const createData: any = {
      projetoId: data.projetoId,
      item: data.item,
      quantidade: data.quantidade,
      valorUnitario: data.valorUnitario,
      status: data.status ?? CompraStatus.PENDENTE,
    };

    // Adicionar campos opcionais apenas se existirem
    if (data.descricao !== undefined && data.descricao !== null) {
      createData.descricao = data.descricao;
    }
    if (data.imagemUrl !== undefined && data.imagemUrl !== null) {
      createData.imagemUrl = data.imagemUrl;
    }
    if (data.nfUrl !== undefined && data.nfUrl !== null) {
      createData.nfUrl = data.nfUrl;
    }
    if (data.comprovantePagamentoUrl !== undefined && data.comprovantePagamentoUrl !== null) {
      createData.comprovantePagamentoUrl = data.comprovantePagamentoUrl;
    }
    if (data.cotacoes) {
      createData.cotacoesJson = data.cotacoes as any;
    }

    return this.prisma.compra.create({
      data: createData,
    });
  }

  async updatePurchaseStatus(id: number, data: UpdatePurchaseStatusDto) {
    await this.ensurePurchaseExists(id);

    const updateData: any = {
      status: data.status,
    };

    if (data.status === CompraStatus.COMPRADO_ACAMINHO || data.status === CompraStatus.ENTREGUE) {
      updateData.dataConfirmacao = new Date();
    }

    const compra = await this.prisma.compra.update({
      where: { id },
      data: updateData,
    });

    if (data.status === CompraStatus.ENTREGUE) {
      await this.appendToStock(compra);
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
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === CompraStatus.COMPRADO_ACAMINHO || data.status === CompraStatus.ENTREGUE) {
        updateData.dataConfirmacao = new Date();
      }
      if (data.status === CompraStatus.ENTREGUE) {
        const compra = await this.prisma.compra.findUnique({ where: { id } });
        if (compra) {
          await this.appendToStock(compra);
        }
      }
    }

    return this.prisma.compra.update({ where: { id }, data: updateData });
  }

  async deletePurchase(id: number) {
    await this.ensurePurchaseExists(id);
    await this.prisma.compra.delete({ where: { id } });
    return { deleted: true };
  }

  private async appendToStock(compra: { projetoId: number; item: string; quantidade: number; valorUnitario: number }) {
    const existing = await this.prisma.estoque.findFirst({
      where: { item: compra.item, projetoId: compra.projetoId },
    });

    if (existing) {
      await this.prisma.estoque.update({
        where: { id: existing.id },
        data: {
          quantidade: existing.quantidade + compra.quantidade,
          valorUnitario: compra.valorUnitario,
        },
      });
    } else {
      await this.prisma.estoque.create({
        data: {
          item: compra.item,
          quantidade: compra.quantidade,
          valorUnitario: compra.valorUnitario,
          status: EstoqueStatus.DISPONIVEL,
          projetoId: compra.projetoId,
        },
      });
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

  private async ensureItemExists(id: number) {
    const item = await this.prisma.estoque.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado');
    }
  }

  private async ensurePurchaseExists(id: number) {
    const compra = await this.prisma.compra.findUnique({ where: { id } });
    if (!compra) {
      throw new NotFoundException('Compra não encontrada');
    }
  }
}
