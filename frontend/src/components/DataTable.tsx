import { ReactNode, MouseEvent } from 'react';

export interface DataTableColumn<T = any> {
  key: string;
  /** Conteúdo do <th>. Aceita ReactNode para labels responsivos. */
  label: ReactNode;
  /** Substitui completamente o <th> (ex.: cabeçalhos com ordenação). */
  renderTh?: () => ReactNode;
  /** Classes extras para o <th>. */
  thClassName?: string;
  /** Classes extras para o <td>. */
  tdClassName?: string;
  /** Alinhamento da coluna (padrão: 'left'). */
  align?: 'left' | 'right' | 'center';
  /** Função que renderiza o conteúdo da célula. */
  render?: (item: T) => ReactNode;
  /** Se true, o clique neste <td> não dispara o onRowClick da linha. */
  stopRowClick?: boolean;
}

interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  /** Mensagem exibida quando data está vazia. */
  emptyMessage?: string;
  loading?: boolean;
  /** Callback ao clicar na linha (ignorado em colunas com stopRowClick). */
  onRowClick?: (item: T, e: MouseEvent<HTMLTableRowElement>) => void;
  /** Classes extras para cada <tr>. */
  rowClassName?: (item: T) => string;
  /** Classes extras para o wrapper (overflow-x-auto …). */
  wrapperClassName?: string;
  /** Classes extras para o <table>. */
  tableClassName?: string;
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Nenhum registro encontrado',
  loading = false,
  onRowClick,
  rowClassName,
  wrapperClassName = '',
  tableClassName = '',
}: DataTableProps<T>) {
  const colCount = columns.length;

  return (
    <div className={`overflow-x-auto rounded-xl border border-white/10 ${wrapperClassName}`}>
      <table className={`min-w-full text-sm ${tableClassName}`}>
        <thead className="bg-white/5 text-white/70">
          <tr>
            {columns.map((col) => {
              if (col.renderTh) return col.renderTh();

              const align = alignClass[col.align ?? 'left'];
              return (
                <th
                  key={col.key}
                  className={`px-4 py-3 ${align} ${col.thClassName ?? ''}`}
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-8 text-center text-white/50"
              >
                Carregando...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-8 text-center text-white/50"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => {
              const rowKey = keyExtractor(item);
              const extraRowClass = rowClassName ? rowClassName(item) : '';
              const clickable = !!onRowClick;

              return (
                <tr
                  key={rowKey}
                  className={`border-t border-white/5 hover:bg-white/5 transition-colors ${
                    clickable ? 'cursor-pointer' : ''
                  } ${extraRowClass}`}
                  onClick={
                    onRowClick ? (e) => onRowClick(item, e) : undefined
                  }
                >
                  {columns.map((col) => {
                    const align = alignClass[col.align ?? 'left'];
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${align} ${col.tdClassName ?? ''}`}
                        onClick={
                          col.stopRowClick
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {col.render ? col.render(item) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
