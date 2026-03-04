import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';
import { TasksService } from '../tasks/tasks.service';

interface ExcelProjectRow {
  nome?: string;
  resumo?: string;
  objetivo?: string;
  valorTotal?: number;
  supervisorEmail?: string;
  responsaveisEmails?: string;
}

interface ExcelEtapaRow {
  projetoNome?: string;
  nome?: string;
  aba?: string;
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
  valorInsumos?: number;
  executorEmail?: string;
  responsavelEmail?: string;
  integrantesEmails?: string;
}

interface ExcelChecklistRow {
  projetoNome?: string;
  etapaNome?: string;
  itemTexto?: string;
  itemDescricao?: string;
  // Campos abaixo são mantidos para compatibilidade com planilhas antigas
  subitemTexto?: string;
  subitemDescricao?: string;
}

interface ExcelChecklistSubitemRow {
  projetoNome?: string;
  etapaNome?: string;
  itemTexto?: string;
  subitemTexto?: string;
  subitemDescricao?: string;
}

/**
 * Converte valor de data vindo do Excel (número serial, string YYYY/MM/DD ou YYYY-MM-DD, ou Date)
 * para string ISO YYYY-MM-DD. Evita que número serial seja interpretado como timestamp Unix.
 */
function parseDateFromExcel(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') {
    // Excel serial: 1 = 1900-01-01. 25569 = 1970-01-01 (Unix epoch)
    if (value < 1) return undefined;
    const date = new Date((value - 25569) * 86400 * 1000);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return undefined;
  // YYYY/MM/DD ou YYYY-MM-DD
  const match = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

@Injectable()
export class ProjectsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async importFromExcel(fileBuffer: Buffer, userId: number) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;

      if (!sheetNames.includes('Projetos')) {
        throw new BadRequestException('A planilha deve conter uma aba chamada "Projetos"');
      }

      const projetosSheet = workbook.Sheets['Projetos'];
      const projetosData: ExcelProjectRow[] = XLSX.utils.sheet_to_json(projetosSheet);

      const projectMap = new Map<string, number>();

      if (projetosData.length > 0) {
        for (const projetoRow of projetosData) {
          if (!projetoRow.nome?.trim()) continue;

          const nomeProjeto = projetoRow.nome.trim();
          if (projectMap.has(nomeProjeto)) {
            throw new BadRequestException(
              `Dois projetos não podem ter o mesmo nome. Nome duplicado na planilha: "${nomeProjeto}".`,
            );
          }
          const existente = await this.prisma.projeto.findFirst({
            where: { nome: nomeProjeto },
            select: { id: true },
          });
          if (existente) {
            throw new BadRequestException(
              `Já existe um projeto com o nome "${nomeProjeto}" no sistema. Projetos não podem ter o mesmo nome. Use a aba Etapas para adicionar etapas a esse projeto.`,
            );
          }

          let supervisorId: number = userId;
          if (projetoRow.supervisorEmail?.trim()) {
            const supervisor = await this.prisma.usuario.findFirst({
              where: { email: projetoRow.supervisorEmail.trim() },
            });
            if (!supervisor) {
              throw new BadRequestException(`Supervisor não encontrado: ${projetoRow.supervisorEmail}`);
            }
            supervisorId = supervisor.id;
          }

          const responsavelIds: number[] = [];
          if (projetoRow.responsaveisEmails) {
            const emails = projetoRow.responsaveisEmails
              .toString()
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean);
            for (const email of emails) {
              const r = await this.prisma.usuario.findFirst({ where: { email } });
              if (r) responsavelIds.push(r.id);
            }
          }

          const projeto = await this.prisma.projeto.create({
            data: {
              nome: projetoRow.nome.trim(),
              resumo: projetoRow.resumo?.trim() || null,
              objetivo: projetoRow.objetivo?.trim() || null,
              valorTotal: projetoRow.valorTotal ? Number(projetoRow.valorTotal) : 0,
              valorInsumos: 0,
              supervisor: { connect: { id: supervisorId } },
              responsaveis:
                responsavelIds.length > 0
                  ? { create: responsavelIds.map((id) => ({ usuarioId: id })) }
                  : undefined,
            },
          });
          projectMap.set(projeto.nome.trim(), projeto.id);
        }
      }

      const resultados: { projeto?: string; etapa?: string; id?: number; status: string }[] = [];

      const resolveProjectId = async (projetoNome: string): Promise<number | null> => {
        const nome = projetoNome?.trim();
        if (!nome) return null;
        const fromMap = projectMap.get(nome);
        if (fromMap != null) return fromMap;
        const existing = await this.prisma.projeto.findFirst({
          where: { nome },
          select: { id: true },
        });
        return existing?.id ?? null;
      };

      const etapaMap = new Map<string, number>();

      if (sheetNames.includes('Etapas')) {
        const etapasSheet = workbook.Sheets['Etapas'];
        const etapasData: ExcelEtapaRow[] = XLSX.utils.sheet_to_json(etapasSheet);

        for (const etapaRow of etapasData) {
          if (!etapaRow.nome?.trim() || !etapaRow.projetoNome?.trim()) continue;

          const projetoId = await resolveProjectId(etapaRow.projetoNome);
          if (projetoId == null) {
            throw new BadRequestException(
              `Projeto não encontrado: "${etapaRow.projetoNome}". Crie o projeto na aba Projetos ou use o nome exato de um projeto já existente.`,
            );
          }

          let executorId: number = userId;
          if (etapaRow.executorEmail?.trim()) {
            const executor = await this.prisma.usuario.findFirst({
              where: { email: etapaRow.executorEmail.trim() },
            });
            if (!executor) {
              throw new BadRequestException(`Executor não encontrado: ${etapaRow.executorEmail}`);
            }
            executorId = executor.id;
          }

          let responsavelId: number | undefined = undefined;
          if (etapaRow.responsavelEmail?.trim()) {
            const responsavel = await this.prisma.usuario.findFirst({
              where: { email: etapaRow.responsavelEmail.trim() },
            });
            if (!responsavel) {
              throw new BadRequestException(`Responsável da etapa não encontrado: ${etapaRow.responsavelEmail}`);
            }
            responsavelId = responsavel.id;
          }

          const integrantesIds: number[] = [];
          if (etapaRow.integrantesEmails) {
            const emails = etapaRow.integrantesEmails
              .toString()
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean);
            for (const email of emails) {
              const u = await this.prisma.usuario.findFirst({ where: { email } });
              if (u) integrantesIds.push(u.id);
            }
          }

          const etapa = await this.tasksService.create({
            projetoId,
            executorId,
            nome: etapaRow.nome.trim(),
            aba: etapaRow.aba?.trim(),
            descricao: etapaRow.descricao?.trim(),
            dataInicio: parseDateFromExcel(etapaRow.dataInicio) || undefined,
            dataFim: parseDateFromExcel(etapaRow.dataFim) || undefined,
            valorInsumos: etapaRow.valorInsumos ? Number(etapaRow.valorInsumos) : 0,
            checklist: undefined,
            integrantesIds: integrantesIds.length > 0 ? integrantesIds : undefined,
            responsavelId: responsavelId ?? undefined,
          });

          const key = `${etapaRow.projetoNome.trim()}|${etapaRow.nome.trim()}`;
          etapaMap.set(key, etapa.id);
          resultados.push({ projeto: etapaRow.projetoNome.trim(), etapa: etapaRow.nome.trim(), id: etapa.id, status: 'sucesso' });
        }
      }

      const resolveEtapaId = async (projetoNome: string, etapaNome: string): Promise<number | null> => {
        const key = `${projetoNome.trim()}|${etapaNome.trim()}`;
        const fromMap = etapaMap.get(key);
        if (fromMap != null) return fromMap;
        const projetoId = await resolveProjectId(projetoNome);
        if (projetoId == null) return null;
        const etapa = await this.prisma.etapa.findFirst({
          where: { projetoId, nome: etapaNome.trim() },
          select: { id: true },
        });
        return etapa?.id ?? null;
      };

      let checklistRowCount = 0;
      if (sheetNames.includes('Checklist')) {
        const checklistSheet = workbook.Sheets['Checklist'];
        const checklistData: ExcelChecklistRow[] = XLSX.utils.sheet_to_json(checklistSheet);
        checklistRowCount = checklistData.length;

        const hasChecklistSubitens = sheetNames.includes('ChecklistSubitens');
        const subitensByEtapa = new Map<string, ExcelChecklistSubitemRow[]>();

        if (hasChecklistSubitens) {
          const subitensSheet = workbook.Sheets['ChecklistSubitens'];
          const subitensData: ExcelChecklistSubitemRow[] = XLSX.utils.sheet_to_json(subitensSheet);
          checklistRowCount += subitensData.length;

          for (const row of subitensData) {
            if (
              !row.projetoNome?.trim() ||
              !row.etapaNome?.trim() ||
              !row.itemTexto?.trim() ||
              !row.subitemTexto?.trim()
            ) {
              continue;
            }
            const key = `${row.projetoNome.trim()}|${row.etapaNome.trim()}`;
            if (!subitensByEtapa.has(key)) subitensByEtapa.set(key, []);
            subitensByEtapa.get(key)!.push(row);
          }
        }

        const byEtapa = new Map<string, ExcelChecklistRow[]>();
        for (const row of checklistData) {
          if (!row.projetoNome?.trim() || !row.etapaNome?.trim() || !row.itemTexto?.trim()) continue;
          const key = `${row.projetoNome.trim()}|${row.etapaNome.trim()}`;
          if (!byEtapa.has(key)) byEtapa.set(key, []);
          byEtapa.get(key)!.push(row);
        }

        for (const [key, rows] of byEtapa) {
          const [projetoNome, etapaNome] = key.split('|');
          const etapaId = await resolveEtapaId(projetoNome, etapaNome);
          if (etapaId == null) {
            throw new BadRequestException(
              `Etapa não encontrada: projeto "${projetoNome}", etapa "${etapaNome}". Verifique os nomes na aba Etapas ou crie a etapa antes de importar o checklist.`,
            );
          }

          const etapa = await this.prisma.etapa.findUnique({
            where: { id: etapaId },
            select: { checklistJson: true },
          });
          const currentChecklist: any[] = Array.isArray(etapa?.checklistJson) ? etapa!.checklistJson : [];

          const itensMap = new Map<string, any>();
          for (const item of currentChecklist) {
            const t = (item?.texto || '').trim() || `__${itensMap.size}`;
            itensMap.set(t, {
              texto: item?.texto || '',
              descricao: item?.descricao || '',
              concluido: Boolean(item?.concluido),
              subitens: Array.isArray(item?.subitens)
                ? item.subitens.map((s: any) => ({
                    texto: s?.texto || '',
                    descricao: s?.descricao || '',
                    concluido: Boolean(s?.concluido),
                  }))
                : [],
            });
          }

          // Processar itens (aba Checklist)
          for (const row of rows) {
            const itemKey = row.itemTexto!.trim();
            if (!itensMap.has(itemKey)) {
              itensMap.set(itemKey, {
                texto: itemKey,
                descricao: row.itemDescricao?.trim() || '',
                concluido: false,
                subitens: [],
              });
            } else if (row.itemDescricao?.trim()) {
              // Atualizar descrição se vier preenchida na planilha
              const existing = itensMap.get(itemKey);
              if (!existing.descricao) {
                existing.descricao = row.itemDescricao.trim();
              }
            }

            // Compatibilidade: se NÃO existir aba ChecklistSubitens,
            // ainda aceitar subitemTexto/subitemDescricao na mesma aba Checklist
            if (!hasChecklistSubitens && row.subitemTexto?.trim()) {
              const item = itensMap.get(itemKey);
              item.subitens.push({
                texto: row.subitemTexto.trim(),
                descricao: row.subitemDescricao?.trim() || '',
                concluido: false,
              });
            }
          }

          // Se existir aba ChecklistSubitens, processar subitens separados
          if (hasChecklistSubitens) {
            const subRows = subitensByEtapa.get(key) ?? [];
            for (const row of subRows) {
              const itemKey = row.itemTexto!.trim();
              if (!itensMap.has(itemKey)) {
                itensMap.set(itemKey, {
                  texto: itemKey,
                  descricao: '',
                  concluido: false,
                  subitens: [],
                });
              }
              const item = itensMap.get(itemKey);
              item.subitens.push({
                texto: row.subitemTexto!.trim(),
                descricao: row.subitemDescricao?.trim() || '',
                concluido: false,
              });
            }
          }

          const mergedChecklist = Array.from(itensMap.values());
          await this.tasksService.updateChecklist(etapaId, userId, mergedChecklist);
        }
      }

      const totalProjetos = projectMap.size;
      const totalEtapas = etapaMap.size;
      const msg: string[] = [];
      if (totalProjetos > 0) msg.push(`${totalProjetos} projeto(s) criado(s)`);
      if (totalEtapas > 0) msg.push(`${totalEtapas} etapa(s) criada(s)`);
      if (checklistRowCount > 0) msg.push('checklist atualizado(s)');
      return {
        message: msg.length ? `Importação concluída: ${msg.join(', ')}.` : 'Nenhum dado para importar nas abas preenchidas.',
        resultados,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Erro ao processar arquivo Excel: ${error.message}`);
    }
  }

  async exportToExcel(projetoId?: number) {
    const projetos = await this.prisma.projeto.findMany({
      where: projetoId ? { id: projetoId } : undefined,
      include: {
        supervisor: true,
        responsaveis: { include: { usuario: true } },
        etapas: {
          include: {
            executor: true,
            responsavel: true,
            integrantes: { include: { usuario: true } },
          },
        },
      },
    });

    const wb = XLSX.utils.book_new();

    // Aba Projetos (mesma estrutura da importação)
    const projetosRows = projetos.map((projeto) => ({
      nome: projeto.nome,
      resumo: projeto.resumo ?? '',
      objetivo: projeto.objetivo ?? '',
      valorTotal: projeto.valorTotal,
      supervisorEmail: projeto.supervisor?.email ?? '',
      responsaveisEmails: projeto.responsaveis
        .map((r) => r.usuario.email)
        .join(', '),
    }));
    const projetosHeaders = ['nome', 'resumo', 'objetivo', 'valorTotal', 'supervisorEmail', 'responsaveisEmails'];
    const projetosSheet = XLSX.utils.json_to_sheet(projetosRows, {
      header: projetosHeaders,
      skipHeader: false,
    });
    XLSX.utils.book_append_sheet(wb, projetosSheet, 'Projetos');

    const etapasRows: any[] = [];
    const checklistItemRows: any[] = [];
    const checklistSubitemRows: any[] = [];

    for (const projeto of projetos) {
      for (const etapa of projeto.etapas as any[]) {
        etapasRows.push({
          projetoNome: projeto.nome,
          nome: etapa.nome,
          aba: etapa.aba ?? '',
          descricao: etapa.descricao ?? '',
          dataInicio: etapa.dataInicio ? etapa.dataInicio.toISOString().slice(0, 10) : '',
          dataFim: etapa.dataFim ? etapa.dataFim.toISOString().slice(0, 10) : '',
          valorInsumos: etapa.valorInsumos,
          executorEmail: etapa.executor?.email ?? '',
          responsavelEmail: etapa.responsavel?.email ?? '',
          integrantesEmails: Array.isArray(etapa.integrantes)
            ? etapa.integrantes
                .map((i: any) => i.usuario?.email)
                .filter((email: string | undefined) => !!email)
                .join(', ')
            : '',
        });

        if (Array.isArray(etapa.checklistJson)) {
          const checklist = etapa.checklistJson as Array<{
            texto?: string;
            descricao?: string;
            subitens?: Array<{ texto?: string; descricao?: string }>;
          }>;

          for (const item of checklist) {
            const itemTexto = (item.texto ?? '').trim();
            const itemDescricao = (item.descricao ?? '').trim();

            if (!itemTexto && (!item.subitens || item.subitens.length === 0)) {
              continue;
            }

            // Sempre criar linha de item (aba Checklist)
            checklistItemRows.push({
              projetoNome: projeto.nome,
              etapaNome: etapa.nome,
              itemTexto,
              itemDescricao,
            });

            // Criar linhas de subitens (aba ChecklistSubitens)
            if (item.subitens && item.subitens.length > 0) {
              for (const sub of item.subitens) {
                const subTexto = (sub.texto ?? '').trim();
                if (!subTexto) continue;
                checklistSubitemRows.push({
                  projetoNome: projeto.nome,
                  etapaNome: etapa.nome,
                  itemTexto,
                  subitemTexto: subTexto,
                  subitemDescricao: (sub.descricao ?? '').trim(),
                });
              }
            }
          }
        }
      }
    }

    // Aba Etapas (mesma estrutura da importação)
    const etapasHeaders = [
      'projetoNome',
      'nome',
      'aba',
      'descricao',
      'dataInicio',
      'dataFim',
      'valorInsumos',
      'executorEmail',
      'responsavelEmail',
      'integrantesEmails',
    ];
    const etapasSheet = XLSX.utils.json_to_sheet(etapasRows, {
      header: etapasHeaders,
      skipHeader: false,
    });
    XLSX.utils.book_append_sheet(wb, etapasSheet, 'Etapas');

    if (checklistItemRows.length > 0) {
      const checklistHeaders = ['projetoNome', 'etapaNome', 'itemTexto', 'itemDescricao'];
      const checklistSheet = XLSX.utils.json_to_sheet(checklistItemRows, {
        header: checklistHeaders,
        skipHeader: false,
      });
      XLSX.utils.book_append_sheet(wb, checklistSheet, 'Checklist');
    } else {
      // Criar aba vazia apenas com cabeçalho para manter o padrão do modelo
      const checklistHeaders = ['projetoNome', 'etapaNome', 'itemTexto', 'itemDescricao'];
      const emptyChecklistSheet = XLSX.utils.aoa_to_sheet([checklistHeaders]);
      XLSX.utils.book_append_sheet(wb, emptyChecklistSheet, 'Checklist');
    }

    // Sempre criar aba ChecklistSubitens para manter compatibilidade com o modelo
    const checklistSubHeaders = ['projetoNome', 'etapaNome', 'itemTexto', 'subitemTexto', 'subitemDescricao'];
    let checklistSubitensSheet;
    if (checklistSubitemRows.length > 0) {
      checklistSubitensSheet = XLSX.utils.json_to_sheet(checklistSubitemRows, {
        header: checklistSubHeaders,
        skipHeader: false,
      });
    } else {
      checklistSubitensSheet = XLSX.utils.aoa_to_sheet([checklistSubHeaders]);
    }
    XLSX.utils.book_append_sheet(wb, checklistSubitensSheet, 'ChecklistSubitens');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    return buffer;
  }
}
