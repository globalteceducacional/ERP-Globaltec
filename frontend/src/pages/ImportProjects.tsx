import React, { useState, FormEvent, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';
import { buttonStyles } from '../utils/buttonStyles';
import { ExcelDownloadButton } from '../components/ExcelDownloadButton';

export default function ImportProjects() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildTemplateWorkbook = () => {
    const wb = XLSX.utils.book_new();

    const maxRows = 50; // número de linhas "pre-bordadas" para o usuário preencher

    const headerStyle: XLSX.CellStyle = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: '1F4E78' }, // azul escuro parecido com o print
      },
      font: {
        bold: true,
        color: { rgb: 'FFFFFF' },
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
        wrapText: true,
      },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      },
    };

    const bodyCellStyle: XLSX.CellStyle = {
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      },
    };

    const createSheetWithStyledHeader = (
      headers: string[],
      sheetName: string,
      colWidths?: number[],
      dateColumns: number[] = [],
    ) => {
      const sheet = XLSX.utils.aoa_to_sheet([headers]);

      // Estilo do cabeçalho
      headers.forEach((_, index) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: index });
        const cell = sheet[cellRef];
        if (cell) {
          cell.s = headerStyle;
        }
      });

      // Bordas em todas as células de algumas linhas iniciais (tabela visual completa)
      for (let r = 1; r <= maxRows; r += 1) {
        headers.forEach((_, c) => {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          let cell = sheet[cellRef];
          if (!cell) {
            cell = { t: 's', v: '' };
            sheet[cellRef] = cell;
          }

          const isDateCol = dateColumns.includes(c);

          const baseStyle = isDateCol ? { ...bodyCellStyle, numFmt: 'yyyy-mm-dd' } : bodyCellStyle;

          cell.s = cell.s ? { ...cell.s, ...baseStyle } : baseStyle;
        });
      }

      // Garantir que o range da planilha cubra todas as linhas/colunas geradas
      const range = {
        s: { r: 0, c: 0 },
        e: { r: maxRows, c: headers.length - 1 },
      };
      sheet['!ref'] = XLSX.utils.encode_range(range);

      // Largura das colunas (opcional, para ficar mais legível)
      if (colWidths && colWidths.length > 0) {
        sheet['!cols'] = colWidths.map((w) => ({ wch: w }));
      }

      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    };

    // Aba Projetos
    const projetosHeaders = ['nome', 'resumo', 'objetivo', 'valorTotal', 'supervisorEmail', 'responsaveisEmails'];
    createSheetWithStyledHeader(projetosHeaders, 'Projetos', [25, 30, 30, 18, 30, 35]);

    // Aba Etapas
    const etapasHeaders = [
      'projetoNome',
      'nome',
      'descricao',
      'dataInicio',
      'dataFim',
      'valorInsumos',
      'executorEmail',
      'integrantesEmails',
    ];
    // dataInicio (índice 3) e dataFim (índice 4) formatadas como data (yyyy-mm-dd)
    createSheetWithStyledHeader(etapasHeaders, 'Etapas', [25, 25, 35, 14, 14, 18, 28, 32], [3, 4]);

    // Aba Checklist
    const checklistHeaders = ['projetoNome', 'etapaNome', 'itemTexto', 'itemDescricao', 'subitemTexto', 'subitemDescricao'];
    createSheetWithStyledHeader(checklistHeaders, 'Checklist', [25, 25, 35, 35, 30, 35]);

    // Preenchimento automático entre abas
    const etapasSheet = wb.Sheets.Etapas;
    const projetosSheetName = 'Projetos';

    if (etapasSheet) {
      for (let r = 1; r <= maxRows; r += 1) {
        const excelRow = r + 1; // linha real no Excel (começa em 2)

        // Coluna projetoNome (A) da aba Etapas = coluna nome (A) da aba Projetos
        const etapaProjetoCellRef = XLSX.utils.encode_cell({ r, c: 0 });
        const etapaProjetoCell: any = {
          t: 'n',
          f: `${projetosSheetName}!A${excelRow}`,
          s: bodyCellStyle,
        };
        etapasSheet[etapaProjetoCellRef] = etapaProjetoCell;
      }
    }

    const checklistSheet = wb.Sheets.Checklist;

    if (checklistSheet && wb.Sheets.Etapas) {
      const etapasSheetName = 'Etapas';

      for (let r = 1; r <= maxRows; r += 1) {
        const excelRow = r + 1;

        // projetoNome na Checklist (A) = projetoNome em Etapas (A)
        const chkProjetoCellRef = XLSX.utils.encode_cell({ r, c: 0 });
        const chkProjetoCell: any = {
          t: 'n',
          f: `${etapasSheetName}!A${excelRow}`,
          s: bodyCellStyle,
        };
        checklistSheet[chkProjetoCellRef] = chkProjetoCell;

        // etapaNome na Checklist (B) = nome da etapa em Etapas (B)
        const chkEtapaCellRef = XLSX.utils.encode_cell({ r, c: 1 });
        const chkEtapaCell: any = {
          t: 'n',
          f: `${etapasSheetName}!B${excelRow}`,
          s: bodyCellStyle,
        };
        checklistSheet[chkEtapaCellRef] = chkEtapaCell;
      }
    }

    return wb;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar extensão
      const allowedExtensions = ['.xlsx', '.xls'];
      const fileExtension = selectedFile.name
        .toLowerCase()
        .substring(selectedFile.name.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        setError('Formato de arquivo inválido. Use .xlsx ou .xls');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setError(null);
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Selecione um arquivo Excel');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/projects/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(data.message || 'Projetos importados com sucesso!');
      
      // Limpar formulário
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Redirecionar para projetos após 1 segundo
      setTimeout(() => {
        navigate('/projects');
      }, 1000);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/projects')}
            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2"
          >
            ← Voltar para Projetos
          </button>
          <h1 className="text-3xl font-bold mb-2">Importar Projetos</h1>
          <p className="text-gray-400">
            Importe projetos completos com etapas e checklists a partir de uma planilha Excel
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Formato da Planilha</h2>
            <ExcelDownloadButton
              buildWorkbook={buildTemplateWorkbook}
              fileName="modelo-importacao-projetos.xlsx"
              label="Baixar modelo Excel"
              disabled={uploading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            />
          </div>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">Aba "Projetos" (obrigatória)</h3>
              <p className="text-sm mb-2">Colunas:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li><strong>nome</strong> (obrigatório) - Nome do projeto</li>
                <li><strong>resumo</strong> (opcional) - Resumo do projeto</li>
                <li><strong>objetivo</strong> (opcional) - Objetivo do projeto</li>
                <li><strong>valorTotal</strong> (opcional) - Valor total do projeto</li>
                <li><strong>supervisorEmail</strong> (opcional) - Email do supervisor (se não informado, usa o usuário atual)</li>
                <li><strong>responsaveisEmails</strong> (opcional) - Emails dos responsáveis separados por vírgula</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Aba "Etapas" (opcional)</h3>
              <p className="text-sm mb-2">Colunas:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li><strong>projetoNome</strong> (obrigatório) - Nome do projeto (deve corresponder ao nome na aba Projetos)</li>
                <li><strong>nome</strong> (obrigatório) - Nome da etapa</li>
                <li><strong>descricao</strong> (opcional) - Descrição da etapa</li>
                <li><strong>dataInicio</strong> (opcional) - Data de início (formato: YYYY-MM-DD)</li>
                <li><strong>dataFim</strong> (opcional) - Data de fim (formato: YYYY-MM-DD)</li>
                <li><strong>valorInsumos</strong> (opcional) - Valor de insumos da etapa</li>
                <li><strong>executorEmail</strong> (opcional) - Email do executor (se não informado, usa o usuário atual)</li>
                <li><strong>integrantesEmails</strong> (opcional) - Emails dos integrantes separados por vírgula</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Aba "Checklist" (opcional)</h3>
              <p className="text-sm mb-2">Colunas:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li><strong>projetoNome</strong> (obrigatório) - Nome do projeto</li>
                <li><strong>etapaNome</strong> (obrigatório) - Nome da etapa</li>
                <li><strong>itemTexto</strong> (obrigatório) - Texto do item do checklist</li>
                <li><strong>itemDescricao</strong> (opcional) - Descrição do item</li>
                <li><strong>subitemTexto</strong> (opcional) - Texto do subitem (se houver)</li>
                <li><strong>subitemDescricao</strong> (opcional) - Descrição do subitem</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6">
          <div className="mb-6">
            <label htmlFor="file" className="block text-sm font-medium mb-2">
              Arquivo Excel (.xlsx ou .xls)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
            />
            {file && (
              <p className="mt-2 text-sm text-gray-400">
                Arquivo selecionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!file || uploading}
              className={buttonStyles.primary}
            >
              {uploading ? 'Importando...' : 'Importar Projetos'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className={buttonStyles.secondary}
              disabled={uploading}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
