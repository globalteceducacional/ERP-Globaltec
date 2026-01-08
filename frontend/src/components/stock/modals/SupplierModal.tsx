import { FormEvent, useState } from 'react';
import { BaseModal } from './BaseModal';
import { api } from '../../../services/api';
import { toast, formatApiError } from '../../../utils/toast';
import type { Supplier, SupplierForm } from '../../../types/stock';
import { INITIAL_SUPPLIER_FORM } from '../../../constants/stock';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierCreated: (supplier: Supplier) => void;
}

export function SupplierModal({ isOpen, onClose, onSupplierCreated }: SupplierModalProps) {
  const [form, setForm] = useState<SupplierForm>({ ...INITIAL_SUPPLIER_FORM });
  const [loading, setLoading] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para formatar CNPJ
  function formatCNPJ(cnpj: string): string {
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
  function validateCNPJ(cnpj: string): boolean {
    const cleaned = cnpj.replace(/\D/g, '');
    return cleaned.length === 14;
  }

  // Função para buscar dados do CNPJ
  async function fetchCNPJData(cnpj: string) {
    const cleaned = cnpj.replace(/\D/g, '');
    
    if (cleaned.length !== 14) {
      return;
    }

    setLoadingCNPJ(true);
    setError(null);

    try {
      const { data } = await api.get(`/suppliers/cnpj/${cleaned}`);

      setForm({
        ...form,
        razaoSocial: data.razaoSocial || '',
        nomeFantasia: data.nomeFantasia || '',
        endereco: data.endereco || form.endereco,
        contato: data.contato || form.contato,
      });

      toast.success('Dados do CNPJ carregados com sucesso!');
    } catch (err: any) {
      console.error('Erro ao buscar CNPJ:', err);
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingCNPJ(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.razaoSocial.trim()) {
      setError('Razão Social é obrigatória');
      return;
    }
    if (!form.nomeFantasia.trim()) {
      setError('Nome Fantasia é obrigatório');
      return;
    }
    if (!validateCNPJ(form.cnpj)) {
      setError('CNPJ inválido. Deve conter 14 dígitos.');
      return;
    }

    setLoading(true);

    try {
      const cleanedCNPJ = form.cnpj.replace(/\D/g, '');
      const payload: any = {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        cnpj: cleanedCNPJ,
        ativo: form.ativo,
      };

      if (form.endereco && form.endereco.trim()) {
        payload.endereco = form.endereco.trim();
      }
      if (form.contato && form.contato.trim()) {
        payload.contato = form.contato.trim();
      }

      const { data: newSupplier } = await api.post<Supplier>('/suppliers', payload);
      
      toast.success('Fornecedor criado com sucesso!');
      onSupplierCreated(newSupplier);
      handleClose();
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setForm({ ...INITIAL_SUPPLIER_FORM });
    setError(null);
    onClose();
  }

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title="Novo Fornecedor">
      <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">
            CNPJ *
            {loadingCNPJ && (
              <span className="ml-2 text-xs text-primary">Buscando dados...</span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={form.cnpj}
              onChange={async (e) => {
                const formatted = formatCNPJ(e.target.value);
                setForm({ ...form, cnpj: formatted });
                
                const cleaned = formatted.replace(/\D/g, '');
                if (cleaned.length === 14 && !loadingCNPJ) {
                  await fetchCNPJData(formatted);
                }
              }}
              onBlur={async () => {
                const cleaned = form.cnpj.replace(/\D/g, '');
                if (cleaned.length === 14 && !loadingCNPJ && !form.razaoSocial) {
                  await fetchCNPJData(form.cnpj);
                }
              }}
              className="flex-1 bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="00.000.000/0000-00"
              maxLength={18}
              disabled={loadingCNPJ}
            />
            <button
              type="button"
              onClick={() => fetchCNPJData(form.cnpj)}
              disabled={loadingCNPJ || !validateCNPJ(form.cnpj)}
              className="px-4 py-2.5 rounded-md bg-primary/80 hover:bg-primary text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
              title="Buscar dados do CNPJ"
            >
              {loadingCNPJ ? '...' : '🔍'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">
            Razão Social *
          </label>
          <input
            type="text"
            required
            value={form.razaoSocial}
            onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
            className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Digite a razão social"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">
            Nome Fantasia *
          </label>
          <input
            type="text"
            required
            value={form.nomeFantasia}
            onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
            className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Digite o nome fantasia"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">Endereço</label>
          <input
            type="text"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Digite o endereço"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">Contato</label>
          <input
            type="text"
            value={form.contato}
            onChange={(e) => setForm({ ...form, contato: e.target.value })}
            className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Telefone, email ou outro contato"
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-4 border-t border-white/20">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors text-sm sm:text-base"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-md bg-primary hover:bg-primary/80 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {loading ? 'Criando...' : 'Criar Fornecedor'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
