import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
import { BatchPurchaseToAcaminhoDto } from './dto/batch-purchase-to-acaminho.dto';
import { CompraStatus, EstoqueStatus, NotificacaoTipo, RequerimentoTipo } from '@prisma/client';
import { ImportPurchasesXlsxDto } from './dto/import-purchases-xlsx.dto';
import { CreateCuradoriaRegisterDto, CuradoriaItemInput } from './dto/create-curadoria-register.dto';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeHeader(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  /**
   * Salva um data URL (base64) em disco e retorna a URL pública (/uploads/...).
   * Se o valor não for data URL, devolve o próprio valor.
   */
  private async persistDataUrl(
    value: string | undefined | null,
    subdir: string,
  ): Promise<string | undefined> {
    if (!value || typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    const dataUrlMatch = /^data:(.+);base64,(.+)$/i.exec(trimmed);
    if (!dataUrlMatch) {
      // Já é uma URL normal (http, https ou /uploads/...), apenas devolver
      return trimmed;
    }

    const mimeType = dataUrlMatch[1] || 'application/octet-stream';
    const base64Data = dataUrlMatch[2];

    let extension = 'bin';
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    if (mimeToExt[mimeType]) {
      extension = mimeToExt[mimeType];
    } else if (mimeType.startsWith('image/')) {
      extension = mimeType.slice('image/'.length);
    }

    const buffer = Buffer.from(base64Data, 'base64');

    const baseDirEnv = process.env.UPLOADS_DIR;
    const baseDir =
      baseDirEnv && !/^https?:\/\//i.test(baseDirEnv)
        ? baseDirEnv.startsWith('.')
          ? join(process.cwd(), baseDirEnv)
          : baseDirEnv
        : join(process.cwd(), 'uploads');

    const dir = join(baseDir, subdir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
    const filePath = join(dir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const prefix = (process.env.UPLOADS_URL_PREFIX || '/uploads').replace(/\/+$/, '');
    const publicPath = `${prefix}/${subdir}/${filename}`;
    return publicPath;
  }

  private parseNumber(value: unknown): number | undefined {
    if (value == null || value === '') return undefined;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    const raw = String(value).trim();
    let normalized = raw;
    if (raw.includes(',') && raw.includes('.')) {
      // Ex.: 1.234,56
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
      // Ex.: 12,50
      normalized = raw.replace(',', '.');
    }
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  }

  private buildCuradoriaObservation(base: string | undefined, registroId: string): string {
    const trimmed = base?.trim() ?? '';
    const prefix = `Registro Curadoria: ${registroId}`;
    return trimmed ? `${prefix} | ${trimmed}` : prefix;
  }

  private buildDiscountsByTotal(values: number[], descontoTotal: number): number[] {
    const subtotal = values.reduce((sum, value) => sum + value, 0);
    if (subtotal <= 0 || descontoTotal <= 0) {
      return values.map(() => 0);
    }

    const discounts = values.map((value) => Number(((value / subtotal) * descontoTotal).toFixed(2)));
    const sum = discounts.reduce((acc, value) => acc + value, 0);
    const diff = Number((descontoTotal - sum).toFixed(2));
    if (diff !== 0 && discounts.length > 0) {
      discounts[discounts.length - 1] = Number((discounts[discounts.length - 1] + diff).toFixed(2));
    }
    return discounts;
  }

  async fetchBookByIsbn(isbn: string) {
    const cleaned = isbn.toUpperCase().replace(/[^0-9X]/g, '');
    if (!(cleaned.length === 10 || cleaned.length === 13)) {
      throw new BadRequestException('ISBN inválido. Informe 10 ou 13 caracteres.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new BadRequestException('Erro ao buscar dados do ISBN.');
      }

      const payload = await response.json();
      const volumeInfo = payload?.items?.[0]?.volumeInfo;
      if (!volumeInfo) {
        throw new BadRequestException('Livro não encontrado para o ISBN informado.');
      }

      return {
        isbn: cleaned,
        titulo: String(volumeInfo.title ?? '').trim() || null,
        subtitulo: String(volumeInfo.subtitle ?? '').trim() || null,
        autores: Array.isArray(volumeInfo.authors)
          ? volumeInfo.authors.map((author: unknown) => String(author))
          : [],
        editora: String(volumeInfo.publisher ?? '').trim() || null,
        anoPublicacao: String(volumeInfo.publishedDate ?? '').trim() || null,
        categorias: Array.isArray(volumeInfo.categories)
          ? volumeInfo.categories.map((category: unknown) => String(category))
          : [],
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new BadRequestException('Tempo de espera excedido ao buscar dados do ISBN.');
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Erro ao buscar dados do ISBN. Verifique o valor informado.',
      );
    }
  }

  private async createCuradoriaItems(
    items: CuradoriaItemInput[],
    params: {
      projetoId?: number;
      solicitadoPorId: number;
      descontoAplicadoEm: 'item' | 'total';
      descontoTotal?: number;
      observacao?: string;
      registroId: string;
    },
  ) {
    if (!items.length) {
      throw new BadRequestException('Informe ao menos um item no registro.');
    }

    const valores = items.map((item) => item.valor);
    const descontosPorItem =
      params.descontoAplicadoEm === 'total'
        ? this.buildDiscountsByTotal(valores, params.descontoTotal ?? 0)
        : items.map((item) => item.desconto ?? 0);

    const createPayloads = items.map((item, index) => {
      const descontoAplicado = descontosPorItem[index] ?? 0;
      const valorLiquidoUnitario = Number(Math.max(0, item.valor - descontoAplicado).toFixed(2));

      return {
        projetoId: params.projetoId || null,
        categoriaId: item.categoriaId,
        item: item.nome,
        descricao: `ISBN: ${item.isbn}`,
        quantidade: 1,
        valorUnitario: valorLiquidoUnitario,
        status: CompraStatus.SOLICITADO,
        solicitadoPorId: params.solicitadoPorId,
        observacao: this.buildCuradoriaObservation(params.observacao, params.registroId),
        cotacoesJson: [
          {
            valorOriginal: item.valor,
            valorUnitario: valorLiquidoUnitario,
            desconto: descontoAplicado,
            descontoTipo: 'valor',
            isbn: item.isbn,
            registroCuradoriaId: params.registroId,
            descontoAplicadoEm: params.descontoAplicadoEm,
          },
        ],
      };
    });

    await this.prisma.$transaction(
      createPayloads.map((payload) =>
        this.prisma.compra.create({
          data: payload as any,
        }),
      ),
    );

    const totalBruto = Number(valores.reduce((sum, value) => sum + value, 0).toFixed(2));
    const totalDesconto = Number(descontosPorItem.reduce((sum, value) => sum + value, 0).toFixed(2));
    return {
      registroId: params.registroId,
      count: createPayloads.length,
      totalBruto,
      totalDesconto,
      totalLiquido: Number((totalBruto - totalDesconto).toFixed(2)),
    };
  }

  async createCuradoriaRegister(data: CreateCuradoriaRegisterDto, solicitadoPorId: number) {
    if (data.projetoId) {
      await this.ensureProjectExists(data.projetoId);
    }

    const uniqueCategoryIds = Array.from(new Set(data.itens.map((item) => item.categoriaId)));
    const categories = await this.prisma.categoriaCompra.findMany({
      where: { id: { in: uniqueCategoryIds } },
      select: { id: true },
    });
    if (categories.length !== uniqueCategoryIds.length) {
      throw new BadRequestException('Um ou mais itens possuem categoria inválida.');
    }

    if (data.descontoAplicadoEm === 'total' && (data.descontoTotal == null || data.descontoTotal < 0)) {
      throw new BadRequestException('Informe o desconto total quando aplicado no valor total.');
    }

    const registroId = `CUR-${Date.now()}`;
    const result = await this.createCuradoriaItems(data.itens, {
      projetoId: data.projetoId,
      solicitadoPorId,
      descontoAplicadoEm: data.descontoAplicadoEm,
      descontoTotal: data.descontoTotal,
      observacao: data.observacao,
      registroId,
    });

    return {
      message: 'Registro de curadoria criado com sucesso.',
      ...result,
    };
  }

  async importPurchasesFromXlsx(
    fileBuffer: Buffer,
    options: ImportPurchasesXlsxDto,
    solicitadoPorId: number,
  ) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('Planilha XLSX sem abas válidas');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });

    if (!rows.length) {
      throw new BadRequestException('Planilha sem linhas de dados');
    }

    const overwriteCurrent = options.overwriteCurrent === true;
    const projetoId = options.projetoId;
    const categoriaId = options.categoriaId;
    const descontoAplicadoEm = options.descontoAplicadoEm ?? 'item';
    const descontoTotal = options.descontoTotal;

    if (overwriteCurrent && !projetoId) {
      throw new BadRequestException(
        'Para sobrescrever orçamento atual, informe o projeto (projetoId).',
      );
    }

    if (projetoId) {
      await this.ensureProjectExists(projetoId);
    }

    if (categoriaId) {
      const category = await this.prisma.categoriaCompra.findUnique({
        where: { id: categoriaId },
      });
      if (!category) {
        throw new BadRequestException('Categoria informada não existe');
      }
    }

    if (descontoAplicadoEm === 'total' && (descontoTotal == null || descontoTotal < 0)) {
      throw new BadRequestException('Informe descontoTotal para desconto aplicado no total.');
    }

    const removed = overwriteCurrent && projetoId
      ? await this.prisma.compra.deleteMany({
          where: {
            projetoId,
            status: { in: [CompraStatus.SOLICITADO, CompraStatus.PENDENTE, CompraStatus.REPROVADO] },
          },
        })
      : { count: 0 };

    const categoryNameMap = new Map<string, number>();
    if (!categoriaId) {
      const allCategories = await this.prisma.categoriaCompra.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
      });
      for (const category of allCategories) {
        categoryNameMap.set(this.normalizeHeader(category.nome), category.id);
      }
    }

    const importItems: CuradoriaItemInput[] = [];
    let skipped = 0;

    for (const row of rows) {
      const rowMap = new Map<string, unknown>();
      Object.entries(row).forEach(([key, value]) => {
        rowMap.set(this.normalizeHeader(key), value);
      });

      const nome = String(
        rowMap.get('nome') ??
          rowMap.get('item') ??
          rowMap.get('titulo') ??
          rowMap.get('descricao') ??
          '',
      ).trim();
      const isbn = String(
        rowMap.get('isbn') ??
          rowMap.get('codigodebarras') ??
          rowMap.get('codigobarras') ??
          '',
      ).trim();
      const valor = this.parseNumber(
        rowMap.get('valor') ??
          rowMap.get('vunit') ??
          rowMap.get('valorunitario') ??
          rowMap.get('precotabela'),
      );
      const desconto = this.parseNumber(rowMap.get('desconto') ?? rowMap.get('desc')) ?? 0;
      const categoryFromSheet = String(rowMap.get('categoria') ?? '').trim();
      const categoryIdResolved =
        categoriaId ??
        categoryNameMap.get(this.normalizeHeader(categoryFromSheet));

      if (!nome || !isbn || !valor || valor < 0 || !categoryIdResolved) {
        skipped += 1;
        continue;
      }

      importItems.push({
        nome: nome.slice(0, 120),
        isbn: isbn.slice(0, 60),
        categoriaId: categoryIdResolved,
        valor,
        desconto,
      });
    }

    if (!importItems.length) {
      throw new BadRequestException(
        'Nenhum item válido encontrado. Colunas obrigatórias: nome, isbn, categoria, valor.',
      );
    }

    const registroId = `CUR-IMP-${Date.now()}`;
    const result = await this.createCuradoriaItems(importItems, {
      projetoId,
      solicitadoPorId,
      descontoAplicadoEm,
      descontoTotal,
      observacao: 'Importado via planilha XLSX (Curadoria).',
      registroId,
    });

    return {
      message: 'Importação XLSX concluída.',
      imported: result.count,
      skipped,
      removed: removed.count,
      overwriteCurrent,
      projetoId: projetoId ?? null,
      registroId: result.registroId,
      totalBruto: result.totalBruto,
      totalDesconto: result.totalDesconto,
      totalLiquido: result.totalLiquido,
    };
  }

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
      createData.imagemUrl = await this.persistDataUrl(data.imagemUrl, 'stock');
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
      updateData.imagemUrl = data.imagemUrl
        ? await this.persistDataUrl(data.imagemUrl, 'stock')
        : null;
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
    if (
      data.descricao !== undefined &&
      data.descricao !== null &&
      data.descricao.trim().length > 0
    ) {
      createData.descricao = data.descricao;
    }
    // Salvar imagemUrl/NF/comprovante em storage se vierem em base64
    if (
      data.imagemUrl !== undefined &&
      data.imagemUrl !== null &&
      typeof data.imagemUrl === 'string' &&
      data.imagemUrl.trim().length > 0
    ) {
      createData.imagemUrl = await this.persistDataUrl(data.imagemUrl, 'stock');
    }
    if (
      data.nfUrl !== undefined &&
      data.nfUrl !== null &&
      typeof data.nfUrl === 'string' &&
      data.nfUrl.trim().length > 0
    ) {
      createData.nfUrl = await this.persistDataUrl(data.nfUrl, 'stock');
    }
    if (
      data.comprovantePagamentoUrl !== undefined &&
      data.comprovantePagamentoUrl !== null &&
      typeof data.comprovantePagamentoUrl === 'string' &&
      data.comprovantePagamentoUrl.trim().length > 0
    ) {
      createData.comprovantePagamentoUrl = await this.persistDataUrl(
        data.comprovantePagamentoUrl,
        'stock',
      );
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

    return this.prisma.compra.create({
      data: createData,
    });
  }

  async updatePurchaseStatus(id: number, data: UpdatePurchaseStatusDto) {
    // Buscar a compra ANTES do update para ter o status anterior e solicitadoPorId
    const compraAntes = await this.prisma.compra.findUnique({
      where: { id },
      include: {
        solicitadoPor: true,
        projeto: true,
      },
    });

    if (!compraAntes) {
      throw new NotFoundException('Compra não encontrada');
    }

    const statusAnterior = compraAntes.status;
    const novoStatus = data.status;

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
      include: {
        solicitadoPor: true,
        projeto: true,
      },
    });

    // Notificar o solicitante quando o status mudar para COMPRADO_ACAMINHO ou ENTREGUE
    if (compra.solicitadoPorId && statusAnterior !== novoStatus) {
      if (novoStatus === CompraStatus.COMPRADO_ACAMINHO) {
        try {
          const mensagem = compra.previsaoEntrega
            ? `Sua compra "${compra.item}" está a caminho. Previsão de entrega: ${new Date(compra.previsaoEntrega).toLocaleDateString('pt-BR')}.`
            : `Sua compra "${compra.item}" está a caminho.`;
          
          await this.notificationsService.create({
            usuarioId: compra.solicitadoPorId,
            titulo: 'Compra a Caminho',
            mensagem,
            tipo: NotificacaoTipo.INFO,
          });
        } catch (err) {
          this.logger.warn(`Falha ao criar notificação para compra a caminho (compra ${id}, usuário ${compra.solicitadoPorId}): ${err}`);
        }
      } else if (novoStatus === CompraStatus.ENTREGUE) {
        try {
          const mensagem = compra.recebidoPor
            ? `Sua compra "${compra.item}" foi entregue. Recebido por: ${compra.recebidoPor}.`
            : `Sua compra "${compra.item}" foi entregue.`;
          
          await this.notificationsService.create({
            usuarioId: compra.solicitadoPorId,
            titulo: 'Compra Entregue',
            mensagem,
            tipo: NotificacaoTipo.SUCCESS,
          });
        } catch (err) {
          this.logger.warn(`Falha ao criar notificação para compra entregue (compra ${id}, usuário ${compra.solicitadoPorId}): ${err}`);
        }
      }
    }

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

  /** Marca várias compras (PENDENTE) como COMPRADO_ACAMINHO em lote, com dados comuns (NF, forma pagamento, desconto, etc.). */
  async batchPurchaseToAcaminho(dto: BatchPurchaseToAcaminhoDto) {
    const compras = await this.prisma.compra.findMany({
      where: { id: { in: dto.purchaseIds } },
      include: { solicitadoPor: true, projeto: true },
    });

    if (compras.length !== dto.purchaseIds.length) {
      throw new BadRequestException('Um ou mais IDs de compra não foram encontrados.');
    }

    const naoPendentes = compras.filter((c) => c.status !== CompraStatus.PENDENTE);
    if (naoPendentes.length > 0) {
      throw new BadRequestException(
        `Apenas compras com status Pendente podem ser processadas em lote. Itens inválidos: ${naoPendentes.map((c) => c.id).join(', ')}.`
      );
    }

    let observacaoLote = dto.observacao?.trim() || '';
    if (dto.descontoTipo && dto.descontoValor != null && dto.descontoValor > 0) {
      const desc =
        dto.descontoTipo === 'porcentagem'
          ? `${dto.descontoValor}%`
          : `R$ ${dto.descontoValor.toFixed(2)}`;
      observacaoLote = observacaoLote
        ? `${observacaoLote} | Compra em lote. Desconto: ${desc}.`
        : `Compra em lote. Desconto: ${desc}.`;
    } else if (compras.length > 1) {
      observacaoLote = observacaoLote
        ? `${observacaoLote} | Compra em lote (${compras.length} itens).`
        : `Compra em lote (${compras.length} itens).`;
    }

    const updateData: any = {
      status: CompraStatus.COMPRADO_ACAMINHO,
      dataConfirmacao: new Date(),
    };
    if (dto.formaPagamento !== undefined) updateData.formaPagamento = dto.formaPagamento || null;
    if (dto.nfUrl !== undefined) {
      updateData.nfUrl = dto.nfUrl
        ? await this.persistDataUrl(dto.nfUrl, 'stock')
        : null;
    }
    if (dto.comprovantePagamentoUrl !== undefined) {
      updateData.comprovantePagamentoUrl = dto.comprovantePagamentoUrl
        ? await this.persistDataUrl(dto.comprovantePagamentoUrl, 'stock')
        : null;
    }
    if (dto.dataCompra) updateData.dataCompra = new Date(dto.dataCompra);
    if (dto.previsaoEntrega !== undefined)
      updateData.previsaoEntrega = dto.previsaoEntrega ? new Date(dto.previsaoEntrega) : null;
    if (dto.statusEntrega !== undefined) updateData.statusEntrega = dto.statusEntrega;
    if (dto.enderecoEntrega !== undefined) updateData.enderecoEntrega = dto.enderecoEntrega || null;
    if (observacaoLote) {
      updateData.observacao = observacaoLote;
    }

    const updated = await this.prisma.compra.updateMany({
      where: { id: { in: dto.purchaseIds } },
      data: updateData,
    });

    const comprasAtualizadas = await this.prisma.compra.findMany({
      where: { id: { in: dto.purchaseIds } },
      include: { solicitadoPor: true, projeto: true },
    });

    for (const compra of comprasAtualizadas) {
      if (compra.solicitadoPorId) {
        try {
          const msg = compra.previsaoEntrega
            ? `Sua compra "${compra.item}" está a caminho. Previsão de entrega: ${new Date(compra.previsaoEntrega).toLocaleDateString('pt-BR')}.`
            : `Sua compra "${compra.item}" está a caminho.`;
          await this.notificationsService.create({
            usuarioId: compra.solicitadoPorId,
            titulo: 'Compra a Caminho',
            mensagem: msg,
            tipo: NotificacaoTipo.INFO,
          });
        } catch (err) {
          this.logger.warn(
            `Falha ao notificar compra em lote (compra ${compra.id}, usuário ${compra.solicitadoPorId}): ${err}`
          );
        }
      }
    }

    return { count: updated.count, compras: comprasAtualizadas };
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
      updateData.imagemUrl = data.imagemUrl
        ? await this.persistDataUrl(data.imagemUrl, 'stock')
        : null;
    }
    if (data.nfUrl !== undefined) {
      updateData.nfUrl = data.nfUrl ? await this.persistDataUrl(data.nfUrl, 'stock') : null;
    }
    if (data.comprovantePagamentoUrl !== undefined) {
      updateData.comprovantePagamentoUrl = data.comprovantePagamentoUrl
        ? await this.persistDataUrl(data.comprovantePagamentoUrl, 'stock')
        : null;
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

      await this.prisma.estoque.update({
        where: { id: existing.id },
        data: {
          quantidade: existing.quantidade + compra.quantidade,
          valorUnitario: compra.valorUnitario ?? existing.valorUnitario,
          imagemUrl: imagemUrlFinal,
          descricao: compra.descricao && compra.descricao.trim().length > 0 
            ? compra.descricao 
            : existing.descricao,
          cotacoesJson: compra.cotacoesJson || existing.cotacoesJson,
        },
      });
    } else {
      const imagemUrlFinal = compra.imagemUrl && compra.imagemUrl.trim().length > 0 ? compra.imagemUrl : null;

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

    const compraAprovada = await this.prisma.compra.update({
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

    // Criar requerimento e notificação linkada para o solicitante
    if ((compraAprovada as any).solicitadoPorId) {
      // Primeiro criar o requerimento (detalhes completos)
      const requerimentoId = await this.criarRequerimentoAprovacaoCompra(
        (compraAprovada as any).solicitadoPorId,
        compraAprovada.item,
      );

      // Depois criar a notificação linkada ao requerimento (aviso resumido)
      await this.notificationsService.create({
        usuarioId: (compraAprovada as any).solicitadoPorId,
        titulo: 'Solicitação de Compra Aprovada',
        mensagem: `Sua solicitação de compra "${compraAprovada.item}" foi aprovada. Clique para ver detalhes.`,
        tipo: NotificacaoTipo.INFO,
        requerimentoId: requerimentoId ?? undefined, // Link para o requerimento
      });
    }

    return compraAprovada;
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

    // Criar requerimento e notificação linkada para o solicitante
    if ((compraReprovada as any).solicitadoPorId) {
      // Primeiro criar o requerimento (detalhes completos)
      const requerimentoId = await this.criarRequerimentoRecusaCompra(
        (compraReprovada as any).solicitadoPorId,
        compraReprovada.item,
        motivoRejeicao.trim(),
      );

      // Depois criar a notificação linkada ao requerimento (aviso resumido)
      await this.notificationsService.create({
        usuarioId: (compraReprovada as any).solicitadoPorId,
        titulo: 'Solicitação de Compra Reprovada',
        mensagem: `Sua solicitação de compra "${compraReprovada.item}" foi reprovada. Clique para ver detalhes.`,
        tipo: NotificacaoTipo.INFO,
        requerimentoId: requerimentoId ?? undefined, // Link para o requerimento
      });
    }

    // Notificar supervisor do projeto se houver
    if ((compraReprovada as any).projeto?.supervisorId) {
      await this.notificationsService.create({
        usuarioId: (compraReprovada as any).projeto.supervisorId,
        titulo: 'Solicitação de Compra Reprovada',
        mensagem: `A solicitação de compra "${compraReprovada.item}" do projeto "${(compraReprovada as any).projeto.nome}" foi reprovada. Clique para ver detalhes.`,
        tipo: NotificacaoTipo.INFO,
      });
    }

    return compraReprovada;
  }

  /**
   * Cria um requerimento do tipo INFORMACAO para o solicitante quando uma compra é recusada
   * Retorna o ID do requerimento criado para linkar com a notificação
   */
  private async criarRequerimentoRecusaCompra(
    destinatarioId: number,
    itemNome: string,
    motivoRejeicao: string,
  ): Promise<number | null> {
    try {
      // Buscar um usuário DIRETOR, GM, COTADOR ou PAGADOR para ser o remetente
      // Priorizar um usuário diferente do destinatário
      const cargosSistema = await this.prisma.cargo.findMany({
        where: {
          OR: [{ nome: 'DIRETOR' }, { nome: 'GM' }, { nome: 'COTADOR' }, { nome: 'PAGADOR' }],
          ativo: true,
        },
      });

      let remetenteSistemaId: number | null = null;
      
      // Tentar encontrar um usuário diferente do destinatário
      for (const cargo of cargosSistema) {
        const usuarioSistema = await this.prisma.usuario.findFirst({
          where: {
            cargoId: cargo.id,
            ativo: true,
            id: { not: destinatarioId },
          },
        });
        if (usuarioSistema) {
          remetenteSistemaId = usuarioSistema.id;
          break;
        }
      }

      // Se não encontrou usuário diferente, usar o primeiro disponível
      if (!remetenteSistemaId) {
        for (const cargo of cargosSistema) {
          const usuarioSistema = await this.prisma.usuario.findFirst({
            where: {
              cargoId: cargo.id,
              ativo: true,
            },
          });
          if (usuarioSistema) {
            remetenteSistemaId = usuarioSistema.id;
            break;
          }
        }
      }

      // Fallback: usar o primeiro usuário ativo
      if (!remetenteSistemaId) {
        const usuarioFallback = await this.prisma.usuario.findFirst({
          where: { ativo: true },
          orderBy: { id: 'asc' },
        });
        if (usuarioFallback) {
          remetenteSistemaId = usuarioFallback.id;
        }
      }

      if (!remetenteSistemaId) {
        return null;
      }

      // Criar o requerimento
      const requerimento = await this.prisma.requerimento.create({
        data: {
          usuarioId: remetenteSistemaId,
          destinatarioId: destinatarioId,
          tipo: RequerimentoTipo.INFORMACAO,
          texto: `Sua solicitação de compra "${itemNome}" foi REPROVADA.\n\nMotivo: ${motivoRejeicao}`,
          etapaId: null,
        },
      });

      return requerimento.id;
    } catch {
      return null;
    }
  }

  /**
   * Cria um requerimento do tipo INFORMACAO para o solicitante quando uma compra é aprovada
   * Retorna o ID do requerimento criado para linkar com a notificação
   */
  private async criarRequerimentoAprovacaoCompra(
    destinatarioId: number,
    itemNome: string,
  ): Promise<number | null> {
    try {
      // Buscar um usuário DIRETOR, GM, COTADOR ou PAGADOR para ser o remetente
      // Priorizar um usuário diferente do destinatário
      const cargosSistema = await this.prisma.cargo.findMany({
        where: {
          OR: [{ nome: 'DIRETOR' }, { nome: 'GM' }, { nome: 'COTADOR' }, { nome: 'PAGADOR' }],
          ativo: true,
        },
      });

      let remetenteSistemaId: number | null = null;
      
      // Tentar encontrar um usuário diferente do destinatário
      for (const cargo of cargosSistema) {
        const usuarioSistema = await this.prisma.usuario.findFirst({
          where: {
            cargoId: cargo.id,
            ativo: true,
            id: { not: destinatarioId },
          },
        });
        if (usuarioSistema) {
          remetenteSistemaId = usuarioSistema.id;
          break;
        }
      }

      // Se não encontrou usuário diferente, usar o primeiro disponível
      if (!remetenteSistemaId) {
        for (const cargo of cargosSistema) {
          const usuarioSistema = await this.prisma.usuario.findFirst({
            where: {
              cargoId: cargo.id,
              ativo: true,
            },
          });
          if (usuarioSistema) {
            remetenteSistemaId = usuarioSistema.id;
            break;
          }
        }
      }

      // Fallback: usar o primeiro usuário ativo
      if (!remetenteSistemaId) {
        const usuarioFallback = await this.prisma.usuario.findFirst({
          where: { ativo: true },
          orderBy: { id: 'asc' },
        });
        if (usuarioFallback) {
          remetenteSistemaId = usuarioFallback.id;
        }
      }

      if (!remetenteSistemaId) {
        return null;
      }

      // Criar o requerimento
      const requerimento = await this.prisma.requerimento.create({
        data: {
          usuarioId: remetenteSistemaId,
          destinatarioId: destinatarioId,
          tipo: RequerimentoTipo.INFORMACAO,
          texto: `Sua solicitação de compra "${itemNome}" foi APROVADA e está aguardando pagamento.`,
          etapaId: null,
        },
      });

      return requerimento.id;
    } catch {
      return null;
    }
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
