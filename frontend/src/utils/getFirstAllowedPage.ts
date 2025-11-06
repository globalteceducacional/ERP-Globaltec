import { Usuario } from '../types';

/**
 * Retorna a primeira página permitida para o usuário baseado nas permissões do cargo
 */
export function getFirstAllowedPage(user: Usuario | null): string {
  if (!user) {
    return '/login';
  }

  // Compatibilidade: lidar com cargo como string (antigo) ou objeto (novo)
  let paginasPermitidas: string[] = [];
  
  if (typeof user.cargo === 'string') {
    // Formato antigo: cargo é uma string
    const allowedMap: Record<string, string[]> = {
      DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/occurrences', '/requests', '/users', '/cargos'],
      SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
      EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
      COTADOR: ['/tasks/my', '/stock', '/occurrences'],
      PAGADOR: ['/tasks/my', '/stock', '/occurrences'],
    };
    paginasPermitidas = allowedMap[user.cargo] || [];
  } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
    // Formato novo: cargo é um objeto com propriedade nome
    if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
      paginasPermitidas = user.cargo.paginasPermitidas;
    } else {
      // Fallback para compatibilidade com sistema antigo
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/occurrences', '/requests', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
        EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
        COTADOR: ['/tasks/my', '/stock', '/occurrences'],
        PAGADOR: ['/tasks/my', '/stock', '/occurrences'],
      };
      paginasPermitidas = allowedMap[user.cargo.nome] || [];
    }
  }

  // Se não há páginas permitidas, retornar uma página padrão
  if (paginasPermitidas.length === 0) {
    return '/tasks/my'; // Página padrão segura
  }

  // Retornar a primeira página permitida
  return paginasPermitidas[0];
}

