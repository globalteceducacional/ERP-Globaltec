/**
 * Utilitários compartilhados para estilos de status
 * Usado em MyTasks, ProjectDetails e outras páginas
 */

// Cores para status de etapa/tarefa
export function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDENTE':
      return 'bg-amber-500/30 text-amber-200 border border-amber-400/50 font-medium';
    case 'EM_ANDAMENTO':
      return 'bg-sky-500/30 text-sky-200 border border-sky-400/50 font-medium';
    case 'EM_ANALISE':
      return 'bg-violet-500/30 text-violet-200 border border-violet-400/50 font-medium';
    case 'APROVADA':
    case 'ENTREGUE':
      return 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 font-medium';
    case 'REPROVADA':
    case 'REPROVADO':
      return 'bg-rose-500/30 text-rose-200 border border-rose-400/50 font-medium';
    case 'FINALIZADO':
      return 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 font-medium';
    case 'COMPRADO_ACAMINHO':
      return 'bg-sky-500/30 text-sky-200 border border-sky-400/50 font-medium';
    case 'SOLICITADO':
      return 'bg-amber-500/30 text-amber-200 border border-amber-400/50 font-medium';
    default:
      return 'bg-slate-500/20 text-slate-300 border border-slate-400/40';
  }
}

// Labels para status de etapa
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente',
    EM_ANDAMENTO: 'Em Andamento',
    EM_ANALISE: 'Em Análise',
    APROVADA: 'Completo',
    REPROVADA: 'Recusada',
    REPROVADO: 'Reprovado',
    FINALIZADO: 'Finalizado',
    ENTREGUE: 'Entregue',
    COMPRADO_ACAMINHO: 'Comprado/A Caminho',
    SOLICITADO: 'Solicitado',
  };
  return labels[status] || status;
}

// Cores para status de entrega
export function getEntregaStatusColor(status: string): string {
  switch (status) {
    case 'EM_ANALISE':
      return 'bg-violet-500/30 text-violet-200 border border-violet-400/50 font-medium';
    case 'APROVADA':
      return 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 font-medium';
    case 'RECUSADA':
      return 'bg-rose-500/30 text-rose-200 border border-rose-400/50 font-medium';
    default:
      return 'bg-slate-500/20 text-slate-300 border border-slate-400/40';
  }
}

// Labels para status de entrega
export function getEntregaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    EM_ANALISE: 'Em Análise',
    APROVADA: 'Completo',
    RECUSADA: 'Recusada',
  };
  return labels[status] || status;
}

// Cores para status de checklist item
export function getChecklistItemStatusColor(status: string): string {
  switch (status) {
    case 'EM_ANALISE':
      return 'bg-violet-500/30 text-violet-200 border-violet-400/50';
    case 'APROVADO':
      return 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50';
    case 'REPROVADO':
      return 'bg-rose-500/30 text-rose-200 border-rose-400/50';
    default:
      return 'bg-amber-500/20 text-amber-200 border-amber-400/40';
  }
}

// Labels para status de checklist item com emoji
export function getChecklistItemStatusLabel(status: string): string {
  switch (status) {
    case 'PENDENTE':
      return '⏳ Pendente';
    case 'EM_ANALISE':
      return '🔍 Em análise';
    case 'APROVADO':
      return '✓ Aprovado';
    case 'REPROVADO':
      return '✗ Reprovado';
    default:
      return status;
  }
}

// Estilo do checkbox marcado/desmarcado
export function getCheckboxStyle(checked: boolean): string {
  return checked
    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/30'
    : 'border-slate-400/50 bg-slate-700/50 hover:border-slate-300/60';
}

// Estilo do item do checklist
export function getChecklistItemStyle(checked: boolean): string {
  return checked
    ? 'bg-emerald-500/10 border border-emerald-500/20'
    : 'bg-white/5 border border-white/10';
}

// Estilo do texto do checklist item
export function getChecklistTextStyle(checked: boolean): string {
  return checked
    ? 'text-emerald-300/70 line-through'
    : 'text-white/90';
}
