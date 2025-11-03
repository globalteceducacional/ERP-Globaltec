import { useEffect, useState, FormEvent } from 'react';
import { api } from '../services/api';

interface Cotacao {
  valorUnitario: number;
  frete: number;
  impostos: number;
  link?: string;
}

interface StockItem {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number;
  status: string;
  descricao?: string | null;
  imagemUrl?: string | null;
  cotacoesJson?: Cotacao[] | null;
  projetoId?: number | null;
  etapaId?: number | null;
}

interface Purchase {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number;
  status: string;
  projetoId: number;
  descricao?: string | null;
  imagemUrl?: string | null;
  cotacoesJson?: Cotacao[] | null;
}

interface Projeto {
  id: number;
  nome: string;
}

interface CreateItemForm {
  item: string;
  descricao: string;
  quantidade: number;
  imagemUrl: string;
  cotacoes: Cotacao[];
  projetoId?: number;
  etapaId?: number;
  status?: string;
  selectedCotacaoIndex?: number; // Índice da cotação selecionada
}

export default function Stock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [itemForm, setItemForm] = useState<CreateItemForm>({
    item: '',
    descricao: '',
    quantidade: 1,
    imagemUrl: '',
    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
    selectedCotacaoIndex: 0,
  });
  const [purchaseForm, setPurchaseForm] = useState<CreateItemForm & { projetoId: number }>({
    item: '',
    descricao: '',
    quantidade: 1,
    imagemUrl: '',
    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
    projetoId: 0,
    selectedCotacaoIndex: 0,
  });

  async function load() {
    try {
      const [{ data: itemsData }, { data: purchasesData }, { data: projectsData }] = await Promise.all([
        api.get<StockItem[]>('/stock/items'),
        api.get<Purchase[]>('/stock/purchases'),
        api.get<Projeto[]>('/projects'),
      ]);
      setItems(itemsData);
      setPurchases(purchasesData);
      setProjects(projectsData);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar estoque');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function calculateTotal(cotacao: Cotacao, quantidade: number): number {
    return (cotacao.valorUnitario + cotacao.frete + cotacao.impostos) * quantidade;
  }

  function addCotacao<T extends CreateItemForm>(form: T, setForm: (f: T) => void) {
    setForm({
      ...form,
      cotacoes: [...form.cotacoes, { valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
    });
  }

  function removeCotacao<T extends CreateItemForm>(form: T, setForm: (f: T) => void, index: number) {
    if (form.cotacoes.length > 1) {
      const newCotacoes = form.cotacoes.filter((_, i) => i !== index);
      setForm({
        ...form,
        cotacoes: newCotacoes,
        selectedCotacaoIndex: form.selectedCotacaoIndex && form.selectedCotacaoIndex >= newCotacoes.length ? 0 : form.selectedCotacaoIndex,
      });
    }
  }

  function updateCotacao<T extends CreateItemForm>(
    form: T,
    setForm: (f: T) => void,
    index: number,
    field: keyof Cotacao,
    value: string | number,
  ) {
    const newCotacoes = [...form.cotacoes];
    newCotacoes[index] = { ...newCotacoes[index], [field]: value };
    setForm({ ...form, cotacoes: newCotacoes });
  }

  // Função para comprimir imagem e garantir que fique dentro do limite
  async function processImageUrl(imageUrl: string, maxLength: number = 2000): Promise<string> {
    // Se for uma URL (não base64), apenas truncar se necessário
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      if (imageUrl.length > maxLength) {
        console.warn(`URL muito longa (${imageUrl.length} chars), truncando para ${maxLength}`);
        return imageUrl.substring(0, maxLength);
      }
      return imageUrl;
    }

    // Se for base64 (data:image/...)
    if (imageUrl.startsWith('data:image/')) {
      // Se já está dentro do limite, retornar como está
      if (imageUrl.length <= maxLength) {
        return imageUrl;
      }

      // Tentar comprimir a imagem
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Criar canvas e redimensionar/comprimir
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Se não conseguir criar canvas, retornar vazio ou URL original truncada
            resolve('');
            return;
          }

          // Calcular tamanho máximo mantendo proporção
          let width = img.width;
          let height = img.height;
          const maxDimension = 800; // Tamanho máximo para comprimir
          let quality = 0.8;

          // Redimensionar se necessário
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Tentar comprimir até ficar dentro do limite
          let compressed = canvas.toDataURL('image/jpeg', quality);
          let attempts = 0;
          const maxAttempts = 10;
          let currentWidth = width;
          let currentHeight = height;

          // Primeiro, tentar reduzir qualidade
          while (compressed.length > maxLength && attempts < maxAttempts && quality > 0.1) {
            quality -= 0.1;
            compressed = canvas.toDataURL('image/jpeg', quality);
            attempts++;
          }

          // Se ainda estiver muito grande, reduzir o tamanho da imagem
          if (compressed.length > maxLength) {
            let scale = 0.8; // Começar reduzindo para 80%
            attempts = 0;
            
            while (compressed.length > maxLength && attempts < 10 && scale > 0.1) {
              currentWidth = Math.floor(width * scale);
              currentHeight = Math.floor(height * scale);
              
              // Garantir tamanho mínimo
              if (currentWidth < 50 || currentHeight < 50) {
                break;
              }
              
              canvas.width = currentWidth;
              canvas.height = currentHeight;
              ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
              compressed = canvas.toDataURL('image/jpeg', 0.6);
              scale -= 0.1;
              attempts++;
            }
          }

          // Se AINDA estiver muito grande, usar PNG com qualidade muito baixa (último recurso)
          // Mas nunca truncar a base64 pois isso quebra o formato
          if (compressed.length > maxLength) {
            console.warn(`Imagem muito grande mesmo após compressão (${compressed.length} chars). Tentando PNG com qualidade mínima.`);
            // Reduzir para tamanho muito pequeno
            const finalWidth = Math.max(50, Math.floor(width * 0.3));
            const finalHeight = Math.max(50, Math.floor(height * 0.3));
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
            compressed = canvas.toDataURL('image/jpeg', 0.5);
            
            // Se ainda assim exceder, retornar vazio para não salvar imagem inválida
            if (compressed.length > maxLength) {
              console.error(`Imagem impossível de comprimir para ${maxLength} chars. Tamanho final: ${compressed.length}. Retornando vazio.`);
              resolve('');
              return;
            }
          }

          resolve(compressed);
        };
        img.onerror = () => {
          // Se houver erro ao carregar, retornar vazio
          resolve('');
        };
        img.src = imageUrl;
      });
    }

    // Se não for nem URL nem base64, retornar como está (truncado se necessário)
    return imageUrl.length > maxLength ? imageUrl.substring(0, maxLength) : imageUrl;
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>, setForm: (f: any) => void, form: any) {
    const file = event.target.files?.[0];
    if (file) {
      // Limitar tamanho do arquivo (ex: 5MB)
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxFileSize) {
        setError('Imagem muito grande. Por favor, escolha uma imagem menor que 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Processar e comprimir a imagem
        const processed = await processImageUrl(base64);
        if (processed) {
          setForm({ ...form, imagemUrl: processed });
        } else {
          setError('Erro ao processar imagem. Por favor, tente novamente.');
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleDeleteItem() {
    if (!itemToDelete) return;
    
    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/stock/items/${itemToDelete.id}`);
      setShowDeleteModal(false);
      setItemToDelete(null);
      load();
    } catch (err: any) {
      let errorMessage = 'Erro ao remover item';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateItem(event: FormEvent) {
    event.preventDefault();
    if (!editingItem) return;
    
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {};
      
      // Adicionar campos apenas se tiverem valor válido
      if (itemForm.item && itemForm.item.trim().length > 0) {
        payload.item = itemForm.item.trim();
      }
      
      if (itemForm.descricao && itemForm.descricao.trim().length > 0) {
        payload.descricao = itemForm.descricao.trim();
      }
      
      if (itemForm.quantidade && itemForm.quantidade > 0) {
        payload.quantidade = Number(itemForm.quantidade);
      }
      
      if (itemForm.imagemUrl && itemForm.imagemUrl.trim().length > 0) {
        const processedImageUrl = await processImageUrl(itemForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
        }
      }
      
      if (itemForm.projetoId && itemForm.projetoId > 0) {
        payload.projetoId = Number(itemForm.projetoId);
      }
      
      if (itemForm.etapaId && itemForm.etapaId > 0) {
        payload.etapaId = Number(itemForm.etapaId);
      }
      
      if (itemForm.status) {
        payload.status = itemForm.status;
      }
      
      if (itemForm.cotacoes && itemForm.cotacoes.length > 0) {
        const cotacoesFiltradas = itemForm.cotacoes
          .map((cot) => {
            const valorUnitario = Number(cot.valorUnitario) || 0;
            const frete = Number(cot.frete) || 0;
            const impostos = Number(cot.impostos) || 0;
            
            if (valorUnitario > 0 && frete >= 0 && impostos >= 0) {
              const cotacao: any = {
                valorUnitario,
                frete,
                impostos,
              };
              if (cot.link && cot.link.trim().length > 0) {
                cotacao.link = cot.link.trim();
              }
              return cotacao;
            }
            return null;
          })
          .filter((cot) => cot !== null);
        
        if (cotacoesFiltradas.length > 0) {
          payload.cotacoes = cotacoesFiltradas;
        }
      }

      await api.patch(`/stock/items/${editingItem.id}`, payload);
      
      setShowEditModal(false);
      setEditingItem(null);
      setItemForm({
        item: '',
        descricao: '',
        quantidade: 1,
        imagemUrl: '',
        cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
        selectedCotacaoIndex: 0,
      });
      load();
    } catch (err: any) {
      let errorMessage = 'Erro ao atualizar item';
      if (err.response?.data?.message) {
        if (Array.isArray(err.response.data.message)) {
          errorMessage = err.response.data.message
            .map((msg: any) => {
              if (typeof msg === 'string') return msg;
              if (msg.constraints) {
                return Object.values(msg.constraints).join(', ');
              }
              return JSON.stringify(msg);
            })
            .join('. ');
        } else {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateItem(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      console.log('=== INÍCIO: Criar Item ===');
      console.log('Form completo:', itemForm);
      
      const selectedCotacao = itemForm.cotacoes[itemForm.selectedCotacaoIndex ?? 0];
      if (!selectedCotacao) {
        setError('Selecione uma cotação');
        setSubmitting(false);
        return;
      }

      console.log('Cotação selecionada:', selectedCotacao);

      const totalPorUnidade = selectedCotacao.valorUnitario + selectedCotacao.frete + selectedCotacao.impostos;
      console.log('Total por unidade calculado:', totalPorUnidade);

      // Preparar payload removendo campos undefined/vazios
      const payload: any = {
        item: itemForm.item.trim(),
        quantidade: Number(itemForm.quantidade),
        valorUnitario: Number(totalPorUnidade.toFixed(2)),
      };

      console.log('Payload base criado:', payload);

      // Adicionar campos opcionais apenas se tiverem valor válido (não vazio)
      if (itemForm.descricao && itemForm.descricao.trim().length > 0) {
        payload.descricao = itemForm.descricao.trim();
        console.log('✓ descricao adicionada:', payload.descricao);
      } else {
        console.log('✗ descricao omitida (vazia ou undefined)');
      }
      
      if (itemForm.imagemUrl && itemForm.imagemUrl.trim().length > 0) {
        // Processar imagem para garantir que fique dentro do limite
        const processedImageUrl = await processImageUrl(itemForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
          console.log('✓ imagemUrl processada e adicionada:', payload.imagemUrl.substring(0, 50) + '...', `(${payload.imagemUrl.length} chars)`);
        } else {
          console.log('✗ imagemUrl omitida após processamento (vazia ou inválida)');
        }
      } else {
        console.log('✗ imagemUrl omitida (vazia ou undefined)');
      }
      
      if (itemForm.projetoId && itemForm.projetoId > 0) {
        payload.projetoId = Number(itemForm.projetoId);
        console.log('✓ projetoId adicionado:', payload.projetoId);
      } else {
        console.log('✗ projetoId omitido');
      }
      
      if (itemForm.etapaId && itemForm.etapaId > 0) {
        payload.etapaId = Number(itemForm.etapaId);
        console.log('✓ etapaId adicionado:', payload.etapaId);
      } else {
        console.log('✗ etapaId omitido');
      }
      
      // Sempre enviar cotações (array com pelo menos uma cotação)
      if (itemForm.cotacoes && itemForm.cotacoes.length > 0) {
        const cotacoesFiltradas = itemForm.cotacoes
          .map((cot, index) => {
            const valorUnitario = Number(cot.valorUnitario) || 0;
            const frete = Number(cot.frete) || 0;
            const impostos = Number(cot.impostos) || 0;
            
            console.log(`Cotação ${index + 1} raw:`, { valorUnitario: cot.valorUnitario, frete: cot.frete, impostos: cot.impostos });
            
            // Só incluir se todos os valores forem válidos (maiores que 0)
            if (valorUnitario > 0 && frete >= 0 && impostos >= 0) {
              const cotacao: any = {
                valorUnitario,
                frete,
                impostos,
              };
              if (cot.link && cot.link.trim().length > 0) {
                cotacao.link = cot.link.trim();
              }
              console.log(`✓ Cotação ${index + 1} válida:`, cotacao);
              return cotacao;
            }
            console.log(`✗ Cotação ${index + 1} inválida (valorUnitario: ${valorUnitario})`);
            return null;
          })
          .filter((cot) => cot !== null); // Remove cotações inválidas
        
        if (cotacoesFiltradas.length > 0) {
          payload.cotacoes = cotacoesFiltradas;
          console.log('✓ cotações adicionadas:', cotacoesFiltradas.length, 'cotação(ões)');
        } else {
          console.log('✗ Nenhuma cotação válida encontrada');
        }
      } else {
        console.log('✗ Sem cotações no formulário');
      }

      // Limpar propriedades undefined/null do payload final
      const cleanPayload = Object.keys(payload).reduce((acc: Record<string, any>, key) => {
        if (payload[key] !== undefined && payload[key] !== null) {
          acc[key] = payload[key];
        } else {
          console.log(`⚠ Removido campo ${key} com valor ${payload[key]}`);
        }
        return acc;
      }, {});

      console.log('=== PAYLOAD FINAL (LIMPO) ===');
      console.log(JSON.stringify(cleanPayload, null, 2));
      console.log('Campos incluídos:', Object.keys(cleanPayload));
      console.log('Tipos dos campos:', {
        item: typeof cleanPayload.item,
        quantidade: typeof cleanPayload.quantidade,
        valorUnitario: typeof cleanPayload.valorUnitario,
        descricao: cleanPayload.descricao ? typeof cleanPayload.descricao : 'NÃO INCLUÍDO',
        imagemUrl: cleanPayload.imagemUrl ? typeof cleanPayload.imagemUrl : 'NÃO INCLUÍDO',
        cotacoes: cleanPayload.cotacoes ? typeof cleanPayload.cotacoes + ' (length: ' + cleanPayload.cotacoes.length + ')' : 'NÃO INCLUÍDO',
      });

      const response = await api.post('/stock/items', cleanPayload);
      console.log('=== SUCESSO ===');
      console.log('Resposta do servidor:', response.data);

      setShowItemModal(false);
      setItemForm({
        item: '',
        descricao: '',
        quantidade: 1,
        imagemUrl: '',
        cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
        selectedCotacaoIndex: 0,
      });
      load();
    } catch (err: any) {
      console.error('=== ERRO AO CRIAR ITEM ===');
      console.error('Erro completo:', err);
      console.error('Status:', err.response?.status);
      console.error('Status Text:', err.response?.statusText);
      console.error('Headers:', err.response?.headers);
      console.error('Data completa:', err.response?.data);
      
      if (err.response?.data) {
        console.error('Mensagem de erro:', err.response.data.message);
        console.error('Erros de validação:', err.response.data.message);
        if (Array.isArray(err.response.data.message)) {
          console.error('Array de erros:', err.response.data.message);
          err.response.data.message.forEach((msg: any, index: number) => {
            console.error(`  Erro ${index + 1}:`, msg);
          });
        }
      }
      
      // Formatar mensagem de erro de forma mais clara
      let errorMessage = 'Erro ao criar item';
      if (err.response?.data?.message) {
        if (Array.isArray(err.response.data.message)) {
          errorMessage = err.response.data.message
            .map((msg: any) => {
              if (typeof msg === 'string') return msg;
              if (msg.constraints) {
                return Object.values(msg.constraints).join(', ');
              }
              return JSON.stringify(msg);
            })
            .join('. ');
        } else {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.error('Mensagem formatada para exibição:', errorMessage);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
      console.log('=== FIM: Criar Item ===');
    }
  }

  async function handleCreatePurchase(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      console.log('=== INÍCIO: Criar Compra ===');
      console.log('Form completo:', purchaseForm);
      
      if (!purchaseForm.projetoId) {
        setError('Selecione um projeto');
        setSubmitting(false);
        return;
      }

      const selectedCotacao = purchaseForm.cotacoes[purchaseForm.selectedCotacaoIndex ?? 0];
      if (!selectedCotacao) {
        setError('Selecione uma cotação');
        setSubmitting(false);
        return;
      }

      console.log('Cotação selecionada:', selectedCotacao);

      const totalPorUnidade = selectedCotacao.valorUnitario + selectedCotacao.frete + selectedCotacao.impostos;
      console.log('Total por unidade calculado:', totalPorUnidade);

      // Preparar payload removendo campos undefined/vazios
      const payload: any = {
        projetoId: Number(purchaseForm.projetoId),
        item: purchaseForm.item.trim(),
        quantidade: Number(purchaseForm.quantidade),
        valorUnitario: Number(totalPorUnidade.toFixed(2)),
      };

      console.log('Payload base criado:', payload);

      // Adicionar campos opcionais apenas se tiverem valor válido (não vazio)
      if (purchaseForm.descricao && purchaseForm.descricao.trim().length > 0) {
        payload.descricao = purchaseForm.descricao.trim();
        console.log('✓ descricao adicionada:', payload.descricao);
      } else {
        console.log('✗ descricao omitida (vazia ou undefined)');
      }
      
      if (purchaseForm.imagemUrl && purchaseForm.imagemUrl.trim().length > 0) {
        // Processar imagem para garantir que fique dentro do limite
        const processedImageUrl = await processImageUrl(purchaseForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
          console.log('✓ imagemUrl processada e adicionada:', payload.imagemUrl.substring(0, 50) + '...', `(${payload.imagemUrl.length} chars)`);
        } else {
          console.log('✗ imagemUrl omitida após processamento (vazia ou inválida)');
        }
      } else {
        console.log('✗ imagemUrl omitida (vazia ou undefined)');
      }
      
      // Sempre enviar cotações (array com pelo menos uma cotação)
      if (purchaseForm.cotacoes && purchaseForm.cotacoes.length > 0) {
        const cotacoesFiltradas = purchaseForm.cotacoes
          .map((cot, index) => {
            const valorUnitario = Number(cot.valorUnitario) || 0;
            const frete = Number(cot.frete) || 0;
            const impostos = Number(cot.impostos) || 0;
            
            console.log(`Cotação ${index + 1} raw:`, { valorUnitario: cot.valorUnitario, frete: cot.frete, impostos: cot.impostos });
            
            // Só incluir se todos os valores forem válidos (maiores que 0)
            if (valorUnitario > 0 && frete >= 0 && impostos >= 0) {
              const cotacao: any = {
                valorUnitario,
                frete,
                impostos,
              };
              if (cot.link && cot.link.trim().length > 0) {
                cotacao.link = cot.link.trim();
              }
              console.log(`✓ Cotação ${index + 1} válida:`, cotacao);
              return cotacao;
            }
            console.log(`✗ Cotação ${index + 1} inválida (valorUnitario: ${valorUnitario})`);
            return null;
          })
          .filter((cot) => cot !== null); // Remove cotações inválidas
        
        if (cotacoesFiltradas.length > 0) {
          payload.cotacoes = cotacoesFiltradas;
          console.log('✓ cotações adicionadas:', cotacoesFiltradas.length, 'cotação(ões)');
        } else {
          console.log('✗ Nenhuma cotação válida encontrada');
        }
      } else {
        console.log('✗ Sem cotações no formulário');
      }

      // Limpar propriedades undefined/null do payload final
      const cleanPayload = Object.keys(payload).reduce((acc: Record<string, any>, key) => {
        if (payload[key] !== undefined && payload[key] !== null) {
          acc[key] = payload[key];
        } else {
          console.log(`⚠ Removido campo ${key} com valor ${payload[key]}`);
        }
        return acc;
      }, {});

      console.log('=== PAYLOAD FINAL (LIMPO) ===');
      console.log(JSON.stringify(cleanPayload, null, 2));
      console.log('Campos incluídos:', Object.keys(cleanPayload));
      console.log('Tipos dos campos:', {
        projetoId: typeof cleanPayload.projetoId,
        item: typeof cleanPayload.item,
        quantidade: typeof cleanPayload.quantidade,
        valorUnitario: typeof cleanPayload.valorUnitario,
        descricao: cleanPayload.descricao ? typeof cleanPayload.descricao : 'NÃO INCLUÍDO',
        imagemUrl: cleanPayload.imagemUrl ? typeof cleanPayload.imagemUrl : 'NÃO INCLUÍDO',
        cotacoes: cleanPayload.cotacoes ? typeof cleanPayload.cotacoes + ' (length: ' + cleanPayload.cotacoes.length + ')' : 'NÃO INCLUÍDO',
      });

      const response = await api.post('/stock/purchases', cleanPayload);
      console.log('=== SUCESSO ===');
      console.log('Resposta do servidor:', response.data);

      setShowPurchaseModal(false);
      setPurchaseForm({
        item: '',
        descricao: '',
        quantidade: 1,
        imagemUrl: '',
        cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
        projetoId: 0,
        selectedCotacaoIndex: 0,
      });
      load();
    } catch (err: any) {
      console.error('=== ERRO AO CRIAR COMPRA ===');
      console.error('Erro completo:', err);
      console.error('Status:', err.response?.status);
      console.error('Status Text:', err.response?.statusText);
      console.error('Headers:', err.response?.headers);
      console.error('Data completa:', err.response?.data);
      
      if (err.response?.data) {
        console.error('Mensagem de erro:', err.response.data.message);
        console.error('Erros de validação:', err.response.data.message);
        if (Array.isArray(err.response.data.message)) {
          console.error('Array de erros:', err.response.data.message);
          err.response.data.message.forEach((msg: any, index: number) => {
            console.error(`  Erro ${index + 1}:`, msg);
          });
        }
      }
      
      // Formatar mensagem de erro de forma mais clara
      let errorMessage = 'Erro ao criar compra';
      if (err.response?.data?.message) {
        if (Array.isArray(err.response.data.message)) {
          errorMessage = err.response.data.message
            .map((msg: any) => {
              if (typeof msg === 'string') return msg;
              if (msg.constraints) {
                return Object.values(msg.constraints).join(', ');
              }
              return JSON.stringify(msg);
            })
            .join('. ');
        } else {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.error('Mensagem formatada para exibição:', errorMessage);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
      console.log('=== FIM: Criar Compra ===');
    }
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-danger bg-danger/20 border border-danger/50 px-4 py-3 rounded-md">{error}</p>}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Estoque</h3>
          <button
            onClick={() => setShowItemModal(true)}
            className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold"
          >
            Adicionar Item
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Quantidade</th>
                <th className="px-4 py-3 text-left">Cotações</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                    Nenhum item no estoque
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const cotacoes = item.cotacoesJson && Array.isArray(item.cotacoesJson) ? item.cotacoesJson : [];
                  return (
                    <tr key={item.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          {item.imagemUrl && (
                            (item.imagemUrl.startsWith('data:image/') || item.imagemUrl.startsWith('http://') || item.imagemUrl.startsWith('https://')) ? (
                              <img 
                                src={item.imagemUrl} 
                                alt={item.item || 'Item'} 
                                className="w-10 h-10 object-cover rounded"
                                onError={(e) => {
                                  // Se a imagem falhar ao carregar, ocultar ou mostrar placeholder
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null
                          )}
                          <div>
                            <div className="font-medium">{item.item || 'Sem nome'}</div>
                            {item.descricao && <div className="text-xs text-white/60">{item.descricao}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{item.quantidade || 0}</td>
                      <td className="px-4 py-3">
                        {cotacoes.length > 0 ? (
                          <div className="space-y-1">
                            {cotacoes.map((cotacao: Cotacao, index: number) => {
                              const total = (cotacao.valorUnitario || 0) + (cotacao.frete || 0) + (cotacao.impostos || 0);
                              const totalComQuantidade = total * (item.quantidade || 1);
                              return (
                                <div key={index} className="text-sm">
                                  <span className="text-white/70">Cotação {index + 1}: </span>
                                  {cotacao.link ? (
                                    <a
                                      href={cotacao.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                                    >
                                      {totalComQuantidade.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </a>
                                  ) : (
                                    <span className="font-semibold text-primary">
                                      {totalComQuantidade.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-white/50 text-sm">Sem cotações</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{item.status || 'DISPONIVEL'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            setEditingItem(item);
                            
                            // Carregar etapas se houver projetoId
                            let etapasData: any[] = [];
                            if (item.projetoId) {
                              try {
                                const etapasResponse = await api.get(`/projects/${item.projetoId}/tasks`);
                                etapasData = etapasResponse.data || [];
                                setEtapas(etapasData);
                              } catch (err) {
                                console.error('Erro ao carregar etapas:', err);
                                setEtapas([]);
                              }
                            } else {
                              setEtapas([]);
                            }
                            
                            setItemForm({
                              item: item.item || '',
                              descricao: item.descricao || '',
                              quantidade: item.quantidade || 1,
                              imagemUrl: item.imagemUrl || '',
                              cotacoes: item.cotacoesJson && Array.isArray(item.cotacoesJson) 
                                ? item.cotacoesJson 
                                : [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
                              projetoId: item.projetoId || undefined,
                              etapaId: item.etapaId || undefined,
                              status: item.status || 'DISPONIVEL',
                              selectedCotacaoIndex: 0,
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setShowDeleteModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Compras</h3>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold"
          >
            Nova Compra
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Quantidade</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-white/50">
                    Nenhuma compra cadastrada
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {purchase.imagemUrl && (
                          (purchase.imagemUrl.startsWith('data:image/') || purchase.imagemUrl.startsWith('http://') || purchase.imagemUrl.startsWith('https://')) ? (
                            <img
                              src={purchase.imagemUrl}
                              alt={purchase.item || 'Item'}
                              className="w-10 h-10 object-cover rounded"
                              onError={(e) => {
                                // Se a imagem falhar ao carregar, ocultar ou mostrar placeholder
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null
                        )}
                        <div>
                          <div className="font-medium">{purchase.item || 'Sem nome'}</div>
                          {purchase.descricao && <div className="text-xs text-white/60">{purchase.descricao}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{purchase.quantidade || 0}</td>
                    <td className="px-4 py-3">{purchase.status || 'PENDENTE'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Adicionar Item ao Estoque */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Adicionar Item ao Estoque</h2>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={itemForm.item}
                  onChange={(e) => setItemForm({ ...itemForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={itemForm.descricao}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setItemForm, itemForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {itemForm.imagemUrl && (
                  <img src={itemForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={itemForm.quantidade}
                  onChange={(e) => setItemForm({ ...itemForm, quantidade: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Cotações</h3>
                  <button
                    type="button"
                    onClick={() => addCotacao(itemForm, setItemForm)}
                    className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-sm"
                  >
                    + Adicionar Cotação
                  </button>
                </div>

                <div className="space-y-4">
                  {itemForm.cotacoes.map((cotacao, index) => (
                    <div key={index} className="bg-white/10 border border-white/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm text-white">Cotação {index + 1}</span>
                        <div className="flex items-center gap-4">
                          {itemForm.cotacoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCotacao(itemForm, setItemForm, index)}
                              className="text-danger hover:text-danger/80 text-sm font-medium"
                            >
                              Remover
                            </button>
                          )}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="selectedCotacao"
                              checked={itemForm.selectedCotacaoIndex === index}
                              onChange={() => setItemForm({ ...itemForm, selectedCotacaoIndex: index })}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-white/90">Usar esta cotação</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.valorUnitario}
                            onChange={(e) =>
                              updateCotacao(itemForm, setItemForm, index, 'valorUnitario', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Frete (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.frete}
                            onChange={(e) =>
                              updateCotacao(itemForm, setItemForm, index, 'frete', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Impostos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.impostos}
                            onChange={(e) =>
                              updateCotacao(itemForm, setItemForm, index, 'impostos', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Link</label>
                          <input
                            type="url"
                            value={cotacao.link || ''}
                            onChange={(e) => updateCotacao(itemForm, setItemForm, index, 'link', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-sm text-white/70">
                          Total por unidade:{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white hover:text-primary underline cursor-pointer"
                            >
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-white">
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          Total ({itemForm.quantidade} unidades):{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              {calculateTotal(cotacao, itemForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-primary">
                              {calculateTotal(cotacao, itemForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Adicionar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Item */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Editar Item</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                  setError(null);
                  setItemForm({
                    item: '',
                    descricao: '',
                    quantidade: 1,
                    imagemUrl: '',
                    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
                    selectedCotacaoIndex: 0,
                  });
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateItem} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={itemForm.item}
                  onChange={(e) => setItemForm({ ...itemForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={itemForm.descricao}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setItemForm, itemForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {itemForm.imagemUrl && (
                  <img src={itemForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
                )}
                {editingItem.imagemUrl && !itemForm.imagemUrl && (
                  <div className="mt-2">
                    <p className="text-sm text-white/60 mb-2">Imagem atual:</p>
                    <img src={editingItem.imagemUrl} alt="Atual" className="w-32 h-32 object-cover rounded border border-white/20" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={itemForm.quantidade}
                  onChange={(e) => setItemForm({ ...itemForm, quantidade: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Status</label>
                <select
                  value={itemForm.status || 'DISPONIVEL'}
                  onChange={(e) => setItemForm({ ...itemForm, status: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="DISPONIVEL" className="bg-neutral">Disponível</option>
                  <option value="ALOCADO" className="bg-neutral">Alocado</option>
                  <option value="RESERVADO" className="bg-neutral">Reservado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Projeto</label>
                <select
                  value={itemForm.projetoId || ''}
                  onChange={async (e) => {
                    const projetoId = e.target.value ? Number(e.target.value) : undefined;
                    setItemForm({ ...itemForm, projetoId, etapaId: undefined });
                    
                    // Carregar etapas do projeto selecionado
                    if (projetoId) {
                      try {
                        const etapasResponse = await api.get(`/projects/${projetoId}/tasks`);
                        setEtapas(etapasResponse.data || []);
                      } catch (err) {
                        console.error('Erro ao carregar etapas:', err);
                        setEtapas([]);
                      }
                    } else {
                      setEtapas([]);
                    }
                  }}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="" className="bg-neutral">Selecione um projeto...</option>
                  {projects.map((projeto) => (
                    <option key={projeto.id} value={projeto.id} className="bg-neutral text-white">
                      {projeto.nome}
                    </option>
                  ))}
                </select>
              </div>

              {itemForm.projetoId && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Etapa</label>
                  <select
                    value={itemForm.etapaId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, etapaId: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="" className="bg-neutral">Selecione uma etapa...</option>
                    {etapas.map((etapa) => (
                      <option key={etapa.id} value={etapa.id} className="bg-neutral text-white">
                        {etapa.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Cotações</h3>
                  <button
                    type="button"
                    onClick={() => addCotacao(itemForm, setItemForm)}
                    className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-sm"
                  >
                    + Adicionar Cotação
                  </button>
                </div>

                <div className="space-y-4">
                  {itemForm.cotacoes.map((cotacao, index) => (
                    <div key={index} className="bg-white/10 border border-white/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm text-white">Cotação {index + 1}</span>
                        <div className="flex items-center gap-4">
                          {itemForm.cotacoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCotacao(itemForm, setItemForm, index)}
                              className="text-danger hover:text-danger/80 text-sm font-medium"
                            >
                              Remover
                            </button>
                          )}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="selectedCotacaoEdit"
                              checked={itemForm.selectedCotacaoIndex === index}
                              onChange={() => setItemForm({ ...itemForm, selectedCotacaoIndex: index })}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-white/90">Usar esta cotação</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.valorUnitario}
                            onChange={(e) =>
                              updateCotacao(itemForm, setItemForm, index, 'valorUnitario', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Frete (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.frete}
                            onChange={(e) =>
                              updateCotacao(itemForm, setItemForm, index, 'frete', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Impostos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.impostos}
                            onChange={(e) =>
                              updateCotacao(itemForm, setItemForm, index, 'impostos', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Link</label>
                          <input
                            type="url"
                            value={cotacao.link || ''}
                            onChange={(e) => updateCotacao(itemForm, setItemForm, index, 'link', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-sm text-white/70">
                          Total por unidade:{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white hover:text-primary underline cursor-pointer"
                            >
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-white">
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          Total ({itemForm.quantidade} unidades):{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              {calculateTotal(cotacao, itemForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-primary">
                              {calculateTotal(cotacao, itemForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                    setError(null);
                    setItemForm({
                      item: '',
                      descricao: '',
                      quantidade: 1,
                      imagemUrl: '',
                      cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, link: '' }],
                      selectedCotacaoIndex: 0,
                    });
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-8 py-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white">Confirmar Exclusão</h2>
            </div>
            <div className="p-8">
              <p className="text-white/90 mb-2">
                Tem certeza que deseja remover o item:
              </p>
              <p className="text-xl font-semibold text-white mb-6">
                "{itemToDelete.item}"
              </p>
              <p className="text-sm text-white/70 mb-6">
                Esta ação não pode ser desfeita.
              </p>
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md mb-4 text-sm">
                  {error}
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                    setError(null);
                  }}
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="px-6 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleting}
                >
                  {deleting ? 'Removendo...' : 'Confirmar Remoção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Compra */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Nova Compra</h2>
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePurchase} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Projeto *</label>
                <select
                  required
                  value={purchaseForm.projetoId}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, projetoId: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">Selecione um projeto...</option>
                  {projects.map((projeto) => (
                    <option key={projeto.id} value={projeto.id} className="bg-neutral text-white">
                      {projeto.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={purchaseForm.item}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={purchaseForm.descricao}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setPurchaseForm, purchaseForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.imagemUrl && (
                  <img src={purchaseForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={purchaseForm.quantidade}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantidade: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Cotações</h3>
                  <button
                    type="button"
                    onClick={() => addCotacao(purchaseForm, setPurchaseForm)}
                    className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-sm"
                  >
                    + Adicionar Cotação
                  </button>
                </div>

                <div className="space-y-4">
                  {purchaseForm.cotacoes.map((cotacao, index) => (
                    <div key={index} className="bg-white/10 border border-white/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm text-white">Cotação {index + 1}</span>
                        <div className="flex items-center gap-4">
                          {purchaseForm.cotacoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCotacao(purchaseForm, setPurchaseForm, index)}
                              className="text-danger hover:text-danger/80 text-sm font-medium"
                            >
                              Remover
                            </button>
                          )}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="selectedCotacaoPurchase"
                              checked={purchaseForm.selectedCotacaoIndex === index}
                              onChange={() => setPurchaseForm({ ...purchaseForm, selectedCotacaoIndex: index })}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-white/90">Usar esta cotação</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.valorUnitario}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'valorUnitario', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Frete (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.frete}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'frete', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Impostos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.impostos}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'impostos', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Link</label>
                          <input
                            type="url"
                            value={cotacao.link || ''}
                            onChange={(e) => updateCotacao(purchaseForm, setPurchaseForm, index, 'link', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-sm text-white/70">
                          Total por unidade:{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white hover:text-primary underline cursor-pointer"
                            >
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-white">
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          Total ({purchaseForm.quantidade} unidades):{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              {calculateTotal(cotacao, purchaseForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-primary">
                              {calculateTotal(cotacao, purchaseForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Criar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
