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
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
  valorInsumos?: number;
  executorEmail?: string;
  integrantesEmails?: string;
}

interface ExcelChecklistRow {
  projetoNome?: string;
  etapaNome?: string;
  itemTexto?: string;
  itemDescricao?: string;
  subitemTexto?: string;
  subitemDescricao?: string;
}

@Injectable()
export class ProjectsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async importFromExcel(fileBuffer: Buffer, userId: number) {
    try {
      // Ler o arquivo Excel
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      // Verificar se as abas necessárias existem
      const sheetNames = workbook.SheetNames;
      if (!sheetNames.includes('Projetos')) {
        throw new BadRequestException('A planilha deve conter uma aba chamada "Projetos"');
      }

      // Processar aba de Projetos
      const projetosSheet = workbook.Sheets['Projetos'];
      const projetosData: ExcelProjectRow[] = XLSX.utils.sheet_to_json(projetosSheet);

      if (projetosData.length === 0) {
        throw new BadRequestException('A aba "Projetos" está vazia');
      }

      const resultados: any[] = [];

      // Processar cada projeto
      for (const projetoRow of projetosData) {
        if (!projetoRow.nome) {
          continue; // Pular linhas sem nome
        }

        // Buscar supervisor por email
        let supervisorId: number | undefined;
        if (projetoRow.supervisorEmail) {
          const supervisor = await this.prisma.usuario.findFirst({
            where: { email: projetoRow.supervisorEmail.trim() },
          });
          if (!supervisor) {
            throw new BadRequestException(
              `Supervisor não encontrado: ${projetoRow.supervisorEmail}`,
            );
          }
          supervisorId = supervisor.id;
        } else {
          // Se não informado, usar o usuário que está importando
          supervisorId = userId;
        }

        // Buscar responsáveis por emails
        const responsavelIds: number[] = [];
        if (projetoRow.responsaveisEmails) {
          const emails = projetoRow.responsaveisEmails
            .toString()
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e);
          
          for (const email of emails) {
            const responsavel = await this.prisma.usuario.findFirst({
              where: { email },
            });
            if (responsavel) {
              responsavelIds.push(responsavel.id);
            }
          }
        }

        // Criar projeto
        const projeto = await this.prisma.projeto.create({
          data: {
            nome: projetoRow.nome.trim(),
            resumo: projetoRow.resumo?.trim() || null,
            objetivo: projetoRow.objetivo?.trim() || null,
            valorTotal: projetoRow.valorTotal ? Number(projetoRow.valorTotal) : 0,
            valorInsumos: 0,
            supervisor: { connect: { id: supervisorId } },
            responsaveis: responsavelIds.length > 0
              ? { create: responsavelIds.map((id) => ({ usuarioId: id })) }
              : undefined,
          },
          include: {
            supervisor: true,
            responsaveis: { include: { usuario: true } },
          },
        });

        // Processar etapas deste projeto
        if (sheetNames.includes('Etapas')) {
          const etapasSheet = workbook.Sheets['Etapas'];
          const etapasData: ExcelEtapaRow[] = XLSX.utils.sheet_to_json(etapasSheet);
          
          const etapasDoProjeto = etapasData.filter(
            (e) => e.projetoNome?.trim() === projetoRow.nome?.trim(),
          );

          for (const etapaRow of etapasDoProjeto) {
            if (!etapaRow.nome) {
              continue;
            }

            // Buscar executor por email
            let executorId: number;
            if (etapaRow.executorEmail) {
              const executor = await this.prisma.usuario.findFirst({
                where: { email: etapaRow.executorEmail.trim() },
              });
              if (!executor) {
                throw new BadRequestException(
                  `Executor não encontrado: ${etapaRow.executorEmail}`,
                );
              }
              executorId = executor.id;
            } else {
              executorId = userId; // Usar usuário atual se não informado
            }

            // Buscar integrantes por emails
            const integrantesIds: number[] = [];
            if (etapaRow.integrantesEmails) {
              const emails = etapaRow.integrantesEmails
                .toString()
                .split(',')
                .map((e) => e.trim())
                .filter((e) => e);
              
              for (const email of emails) {
                const integrante = await this.prisma.usuario.findFirst({
                  where: { email },
                });
                if (integrante) {
                  integrantesIds.push(integrante.id);
                }
              }
            }

            // Processar checklist desta etapa
            const checklist: any[] = [];
            if (sheetNames.includes('Checklist')) {
              const checklistSheet = workbook.Sheets['Checklist'];
              const checklistData: ExcelChecklistRow[] = XLSX.utils.sheet_to_json(checklistSheet);
              
              const checklistDaEtapa = checklistData.filter(
                (c) =>
                  c.projetoNome?.trim() === projetoRow.nome?.trim() &&
                  c.etapaNome?.trim() === etapaRow.nome?.trim(),
              );

              // Agrupar por item (itens principais)
              const itensMap = new Map<string, any>();
              
              for (const checklistRow of checklistDaEtapa) {
                if (!checklistRow.itemTexto) {
                  continue;
                }

                const itemKey = checklistRow.itemTexto.trim();
                
                if (!itensMap.has(itemKey)) {
                  itensMap.set(itemKey, {
                    texto: itemKey,
                    descricao: checklistRow.itemDescricao?.trim() || undefined,
                    subitens: [],
                  });
                }

                // Adicionar subitem se existir
                if (checklistRow.subitemTexto) {
                  const item = itensMap.get(itemKey);
                  item.subitens.push({
                    texto: checklistRow.subitemTexto.trim(),
                    descricao: checklistRow.subitemDescricao?.trim() || undefined,
                  });
                }
              }

              checklist.push(...Array.from(itensMap.values()));
            }

            // Criar etapa
            await this.tasksService.create({
              projetoId: projeto.id,
              executorId,
              nome: etapaRow.nome.trim(),
              descricao: etapaRow.descricao?.trim(),
              dataInicio: etapaRow.dataInicio || undefined,
              dataFim: etapaRow.dataFim || undefined,
              valorInsumos: etapaRow.valorInsumos ? Number(etapaRow.valorInsumos) : 0,
              checklist: checklist.length > 0 ? checklist : undefined,
              integrantesIds: integrantesIds.length > 0 ? integrantesIds : undefined,
            });
          }
        }

        resultados.push({
          projeto: projeto.nome,
          id: projeto.id,
          status: 'sucesso',
        });
      }

      return {
        message: `${resultados.length} projeto(s) importado(s) com sucesso`,
        resultados,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Erro ao processar arquivo Excel: ${error.message}`,
      );
    }
  }
}
