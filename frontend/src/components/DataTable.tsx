import { ReactNode, MouseEvent, useEffect, useRef, useState } from 'react';

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
  /**
   * Renderiza um card mobile para cada item.
   * Quando fornecido, a tabela fica oculta em telas < sm e os cards
   * são exibidos no lugar (sm:hidden / hidden sm:block automático).
   */
  renderMobileCard?: (item: T) => ReactNode;
  /** Habilita paginação por tabela. */
  paginate?: boolean;
  /** Quantidade inicial de linhas por página. */
  initialPageSize?: number;
  /** Opções de linhas por página. */
  pageSizeOptions?: number[];
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
  renderMobileCard,
  paginate = false,
  initialPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
}: DataTableProps<T>) {
  const colCount = columns.length;
  const hasMobileCards = !!renderMobileCard;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const [showTopScrollbar, setShowTopScrollbar] = useState(false);

  useEffect(() => {
    const syncState = () => {
      const tableEl = tableScrollRef.current;
      const topInnerEl = topScrollInnerRef.current;
      if (!tableEl || !topInnerEl) {
        setShowTopScrollbar(false);
        return;
      }

      const hasOverflow = tableEl.scrollWidth > tableEl.clientWidth + 1;
      setShowTopScrollbar(hasOverflow);
      topInnerEl.style.width = `${tableEl.scrollWidth}px`;
    };

    syncState();
    window.addEventListener('resize', syncState);
    const tableEl = tableScrollRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncState())
        : null;
    if (resizeObserver && tableEl) {
      resizeObserver.observe(tableEl);
    }
    return () => {
      window.removeEventListener('resize', syncState);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [data, columns, hasMobileCards]);

  const handleTopScroll = () => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    tableEl.scrollLeft = topEl.scrollLeft;
  };

  const handleTableScroll = () => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    topEl.scrollLeft = tableEl.scrollLeft;
  };

  const safePageSize = Math.max(1, pageSize);
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;
  const visibleData = paginate ? data.slice(startIndex, endIndex) : data;

  useEffect(() => {
    setPage(1);
  }, [data, paginate, pageSize]);

  return (
    <>
      {/* ── Cards Mobile ─────────────────────────────────────── */}
      {hasMobileCards && (
        <div className="sm:hidden">
          {loading ? (
            <div className="py-8 text-center text-white/50">Carregando...</div>
          ) : visibleData.length === 0 ? (
            <div className="py-8 text-center text-white/50">{emptyMessage}</div>
          ) : (
            <div className="space-y-3">
              {visibleData.map((item) => {
                const rowKey = keyExtractor(item);
                const extraClass = rowClassName ? rowClassName(item) : '';
                return (
                  <div
                    key={rowKey}
                    className={extraClass}
                    onClick={
                      onRowClick
                        ? (e) =>
                            onRowClick(
                              item,
                              e as unknown as MouseEvent<HTMLTableRowElement>,
                            )
                        : undefined
                    }
                  >
                    {renderMobileCard(item)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tabela Desktop ───────────────────────────────────── */}
      <div
        className={`${hasMobileCards ? 'hidden sm:block' : ''} ${
          showTopScrollbar ? 'mb-2' : 'mb-0'
        } sticky top-0 z-20 overflow-x-auto rounded-md border border-white/10 bg-neutral/95`}
        ref={topScrollRef}
        onScroll={handleTopScroll}
        style={{ visibility: showTopScrollbar ? 'visible' : 'hidden' }}
      >
        <div ref={topScrollInnerRef} className="h-2" />
      </div>
      <div
        className={`${hasMobileCards ? 'hidden sm:block' : ''} overflow-x-auto rounded-xl border border-white/10 ${wrapperClassName}`}
        ref={tableScrollRef}
        onScroll={handleTableScroll}
      >
        <table className={`w-full min-w-full text-sm table-auto ${tableClassName}`}>
          <thead className="bg-white/5 text-white/70">
            <tr>
              {columns.map((col) => {
                if (col.renderTh) return col.renderTh();

                const align = alignClass[col.align ?? 'left'];
                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 ${align} whitespace-normal break-words ${col.thClassName ?? ''}`}
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
              visibleData.map((item) => {
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
                          className={`px-4 py-3 min-w-0 whitespace-normal break-words ${align} ${col.tdClassName ?? ''}`}
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

      {paginate && totalItems > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span>Linhas por página</span>
            <select
              value={safePageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || initialPageSize)}
              className="bg-neutral border border-white/20 rounded px-2 py-1 text-xs text-white"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-neutral text-white">
                  {opt}
                </option>
              ))}
            </select>
            <span>
              {totalItems === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded border border-white/20 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded border border-white/20 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </>
  );
}
