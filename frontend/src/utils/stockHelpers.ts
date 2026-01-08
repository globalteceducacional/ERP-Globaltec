import type { Cotacao, Supplier, Category } from '../types/stock';

// Função para formatar CNPJ
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length <= 14) {
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return cleaned;
}

// Função para validar CNPJ básico
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.length === 14;
}

// Função para obter nome do fornecedor
export function getSupplierName(fornecedorId: number | undefined, suppliers: Supplier[]): string {
  if (!fornecedorId) return '-';
  const supplier = suppliers.find((s) => s.id === fornecedorId);
  return supplier ? supplier.nomeFantasia : '-';
}

// Função para obter nome da categoria
export function getCategoryName(categoriaId: number | undefined, categories: Category[]): string {
  if (!categoriaId) return '-';
  const category = categories.find((c) => c.id === categoriaId);
  return category ? category.nome : '-';
}

// Função para calcular valor total de uma cotação
export function calculateCotacaoTotal(cotacao: Cotacao, quantidade: number): number {
  const valorTotal = cotacao.valorUnitario * quantidade;
  const frete = cotacao.frete || 0;
  const impostos = cotacao.impostos || 0;
  const desconto = cotacao.desconto || 0;
  return valorTotal + frete + impostos - desconto;
}

// Função para formatar valor em BRL
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Função para formatar data
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

// Função para formatar data e hora
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR');
}

// Função para obter label de status
export function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    PENDENTE: 'Pendente',
    COMPRADO_ACAMINHO: 'Comprado/A Caminho',
    ENTREGUE: 'Entregue',
    SOLICITADO: 'Solicitado',
    REPROVADO: 'Reprovado',
    NAO_ENTREGUE: 'Não Entregue',
    PARCIAL: 'Parcial',
    CANCELADO: 'Cancelado',
    DISPONIVEL: 'Disponível',
    ALOCADO: 'Alocado',
  };
  return statusMap[status] || status;
}

// Função para obter cor de status
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    PENDENTE: 'bg-yellow-500/20 text-yellow-400',
    COMPRADO_ACAMINHO: 'bg-blue-500/20 text-blue-400',
    ENTREGUE: 'bg-green-500/20 text-green-400',
    SOLICITADO: 'bg-purple-500/20 text-purple-400',
    REPROVADO: 'bg-red-500/20 text-red-400',
    NAO_ENTREGUE: 'bg-orange-500/20 text-orange-400',
    PARCIAL: 'bg-cyan-500/20 text-cyan-400',
    CANCELADO: 'bg-gray-500/20 text-gray-400',
    DISPONIVEL: 'bg-green-500/20 text-green-400',
    ALOCADO: 'bg-blue-500/20 text-blue-400',
  };
  return colorMap[status] || 'bg-white/20 text-white';
}

// Função para atualizar cotação em formulário
export function updateCotacao<T extends { cotacoes: Cotacao[] }>(
  form: T,
  setForm: (f: T) => void,
  index: number,
  field: keyof Cotacao,
  value: any
) {
  const newCotacoes = [...form.cotacoes];
  newCotacoes[index] = { ...newCotacoes[index], [field]: value };
  setForm({ ...form, cotacoes: newCotacoes });
}

// Função para adicionar cotação
export function addCotacao<T extends { cotacoes: Cotacao[] }>(
  form: T,
  setForm: (f: T) => void
) {
  setForm({
    ...form,
    cotacoes: [
      ...form.cotacoes,
      { valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' },
    ],
  });
}

// Função para remover cotação
export function removeCotacao<T extends { cotacoes: Cotacao[]; selectedCotacaoIndex?: number }>(
  form: T,
  setForm: (f: T) => void,
  index: number
) {
  if (form.cotacoes.length > 1) {
    const newCotacoes = form.cotacoes.filter((_, i) => i !== index);
    const newSelectedIndex = form.selectedCotacaoIndex !== undefined
      ? Math.min(form.selectedCotacaoIndex, newCotacoes.length - 1)
      : undefined;
    setForm({ ...form, cotacoes: newCotacoes, selectedCotacaoIndex: newSelectedIndex });
  }
}

// Função para comprimir imagem
export async function compressImage(base64: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

// Função para lidar com upload de imagem
export async function handleImageUpload(file: File, maxWidth: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const compressed = await compressImage(base64, maxWidth);
        resolve(compressed);
      } catch {
        resolve(base64);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
