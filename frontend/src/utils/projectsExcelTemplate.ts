import * as XLSX from 'xlsx-js-style';

// Gera o mesmo modelo usado na tela de importação de projetos,
// com abas Projetos, Etapas, Checklist e ChecklistSubitens,
// incluindo estilos de cabeçalho, bordas e larguras de coluna.
// maxRows define até quantas linhas por aba terão estilos/fórmulas pré-aplicados.
// Aumentado para 5000 para suportar projetos grandes sem "cortar" exportações.
export function buildProjectsTemplateWorkbook(maxRows = 5000): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const headerStyle: XLSX.CellStyle = {
    fill: {
      patternType: 'solid',
      fgColor: { rgb: '1F4E78' }, // azul escuro
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
        (cell as any).s = headerStyle;
      }
    });

    // Bordas em todas as células de algumas linhas iniciais
    for (let r = 1; r <= maxRows; r += 1) {
      headers.forEach((_, c) => {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        let cell = sheet[cellRef] as any;
        if (!cell) {
          cell = { t: 's', v: '' };
          (sheet as any)[cellRef] = cell;
        }

        const isDateCol = dateColumns.includes(c);
        const baseStyle = isDateCol ? { ...bodyCellStyle, numFmt: 'yyyy-mm-dd' } : bodyCellStyle;

        cell.s = cell.s ? { ...cell.s, ...baseStyle } : baseStyle;
      });
    }

    // Range da planilha
    const range = {
      s: { r: 0, c: 0 },
      e: { r: maxRows, c: headers.length - 1 },
    };
    (sheet as any)['!ref'] = XLSX.utils.encode_range(range);

    // Largura das colunas (opcional)
    if (colWidths && colWidths.length > 0) {
      (sheet as any)['!cols'] = colWidths.map((w) => ({ wch: w }));
    }

    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  };

  // Aba Sessões (projetoNome, nome da sessão, ordem)
  const sessoesHeaders = ['projetoNome', 'nome', 'ordem'];
  createSheetWithStyledHeader(sessoesHeaders, 'Sessoes', [25, 25, 12]);

  // Aba Projetos
  const projetosHeaders = ['nome', 'resumo', 'objetivo', 'valorTotal', 'supervisorEmail', 'responsaveisEmails'];
  createSheetWithStyledHeader(projetosHeaders, 'Projetos', [25, 30, 30, 18, 30, 35]);

  // Aba Etapas (sessaoNome vincula a etapa à sessão da aba Sessoes)
  const etapasHeaders = [
    'projetoNome',
    'sessaoNome',
    'nome',
    'aba',
    'descricao',
    'dataInicio',
    'dataFim',
    'valorInsumos',
    'supervisorEmail',
    'responsavelEmail',
    'integrantesEmails',
  ];
  // dataInicio (índice 5) e dataFim (índice 6)
  createSheetWithStyledHeader(etapasHeaders, 'Etapas', [25, 20, 25, 20, 35, 14, 14, 18, 28, 28, 32], [5, 6]);

  // Aba Checklist (itens)
  const checklistHeaders = ['projetoNome', 'etapaNome', 'itemTexto', 'itemDescricao'];
  createSheetWithStyledHeader(checklistHeaders, 'Checklist', [25, 25, 35, 35]);

  // Aba ChecklistSubitens (subitens)
  const checklistSubHeaders = ['projetoNome', 'etapaNome', 'itemTexto', 'subitemTexto', 'subitemDescricao'];
  createSheetWithStyledHeader(checklistSubHeaders, 'ChecklistSubitens', [25, 25, 35, 30, 35]);

  // Preenchimento automático entre abas (referências entre Etapas e as abas de checklist)
  const etapasSheet = wb.Sheets.Etapas;
  const projetosSheetName = 'Projetos';

  if (etapasSheet) {
    for (let r = 1; r <= maxRows; r += 1) {
      const excelRow = r + 1;

      // projetoNome em Etapas (A) = nome em Projetos (A)
      const etapaProjetoCellRef = XLSX.utils.encode_cell({ r, c: 0 });
      const etapaProjetoCell: any = {
        t: 'n',
        f: `${projetosSheetName}!A${excelRow}`,
        s: bodyCellStyle,
      };
      (etapasSheet as any)[etapaProjetoCellRef] = etapaProjetoCell;
    }
  }

  const checklistSheet = wb.Sheets.Checklist;
  const checklistSubSheet = wb.Sheets.ChecklistSubitens;

  if (etapasSheet && (checklistSheet || checklistSubSheet)) {
    const etapasSheetName = 'Etapas';

    for (let r = 1; r <= maxRows; r += 1) {
      const excelRow = r + 1;

      // Etapas: A=projetoNome, B=sessaoNome, C=nome (etapa)
      if (checklistSheet) {
        const chkProjetoCellRef = XLSX.utils.encode_cell({ r, c: 0 });
        const chkProjetoCell: any = {
          t: 'n',
          f: `${etapasSheetName}!A${excelRow}`,
          s: bodyCellStyle,
        };
        (checklistSheet as any)[chkProjetoCellRef] = chkProjetoCell;

        const chkEtapaCellRef = XLSX.utils.encode_cell({ r, c: 1 });
        const chkEtapaCell: any = {
          t: 'n',
          f: `${etapasSheetName}!C${excelRow}`,
          s: bodyCellStyle,
        };
        (checklistSheet as any)[chkEtapaCellRef] = chkEtapaCell;
      }

      if (checklistSubSheet) {
        const subProjetoCellRef = XLSX.utils.encode_cell({ r, c: 0 });
        const subProjetoCell: any = {
          t: 'n',
          f: `${etapasSheetName}!A${excelRow}`,
          s: bodyCellStyle,
        };
        (checklistSubSheet as any)[subProjetoCellRef] = subProjetoCell;

        const subEtapaCellRef = XLSX.utils.encode_cell({ r, c: 1 });
        const subEtapaCell: any = {
          t: 'n',
          f: `${etapasSheetName}!C${excelRow}`,
          s: bodyCellStyle,
        };
        (checklistSubSheet as any)[subEtapaCellRef] = subEtapaCell;
      }
    }
  }

  return wb;
}

