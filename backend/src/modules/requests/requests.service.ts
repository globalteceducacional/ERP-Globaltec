import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RespondRequestDto } from './dto/respond-request.dto';
import { CompraStatus } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: number, data: CreateRequestDto) {
    if (data.etapaId) {
      await this.ensureTaskExists(data.etapaId);
    }

    // Se for tipo COMPRA, buscar destinatário automaticamente (cargo de compras)
    let destinatarioId = data.destinatarioId;
    if (data.tipo === 'COMPRA') {
      // Validar que itensCompra foi fornecido
      if (!data.itensCompra || data.itensCompra.length === 0) {
        throw new BadRequestException('Itens de compra são obrigatórios para requerimentos do tipo COMPRA');
      }
      // Validar que pelo menos uma cotação tenha link em cada item
      if (data.itensCompra && data.itensCompra.length > 0) {
        for (const item of data.itensCompra) {
          if (!item.cotacoes || item.cotacoes.length === 0) {
            throw new BadRequestException(`O item "${item.item}" deve ter pelo menos uma cotação`);
          }

          const temLink = item.cotacoes.some((cotacao) => cotacao.link && cotacao.link.trim().length > 0);
          if (!temLink) {
            throw new BadRequestException(`O item "${item.item}" deve ter pelo menos uma cotação com link`);
          }
        }
      }

      // Buscar um usuário com cargo COTADOR ou PAGADOR
      const cargoCompra = await this.prisma.cargo.findFirst({
        where: {
          OR: [{ nome: 'COTADOR' }, { nome: 'PAGADOR' }],
          ativo: true,
        },
      });

      if (cargoCompra) {
        const usuarioCompra = await this.prisma.usuario.findFirst({
          where: {
            cargoId: cargoCompra.id,
            ativo: true,
          },
        });

        if (usuarioCompra) {
          destinatarioId = usuarioCompra.id;
        }
      }
    }

    // Se for tipo COMPRA, criar as compras primeiro
    if (data.tipo === 'COMPRA' && data.itensCompra && data.itensCompra.length > 0) {
      // Criar o requerimento
      const requerimento = await this.prisma.requerimento.create({
        data: {
          usuarioId,
          destinatarioId: destinatarioId || null,
          etapaId: data.etapaId,
          texto: data.texto || '',
          tipo: data.tipo,
          anexo: data.anexo,
        },
      });

      // Criar as compras para cada item
      const compras = await Promise.all(
        data.itensCompra.map((item) => {
          const createData: any = {
            item: item.item,
            descricao: item.descricao,
            quantidade: item.quantidade,
            status: CompraStatus.SOLICITADO,
            solicitadoPorId: usuarioId,
            imagemUrl: item.imagemUrl,
            categoriaId: item.categoriaId,
            projetoId: item.projetoId || null,
            etapaId: data.etapaId || null,
            observacao: item.observacao,
          };

          // Adicionar cotações se existirem
          if (item.cotacoes && item.cotacoes.length > 0) {
            createData.cotacoesJson = item.cotacoes;
          }

          return this.prisma.compra.create({
            data: createData,
          });
        })
      );

      return {
        requerimento,
        compras,
      };
    }

    // Para outros tipos, validar destinatário e texto
    if (!destinatarioId) {
      throw new BadRequestException('Destinatário é obrigatório para este tipo de requerimento');
    }

    // Para outros tipos, criar apenas o requerimento
    return this.prisma.requerimento.create({
      data: {
        usuarioId,
        destinatarioId: destinatarioId,
        etapaId: data.etapaId,
        texto: data.texto || '',
        tipo: data.tipo || 'OUTRO',
        anexo: data.anexo,
      },
    });
  }

  listSent(usuarioId: number) {
    return this.prisma.requerimento.findMany({
      where: { usuarioId },
      orderBy: { dataCriacao: 'desc' },
      include: { destinatario: true, etapa: true },
    });
  }

  async listReceived(usuarioId: number) {
    return this.prisma.requerimento.findMany({
      where: { 
        destinatarioId: usuarioId,
      },
      orderBy: { dataCriacao: 'desc' },
      include: { usuario: true, etapa: true },
    });
  }

  async findOne(id: number, usuarioId: number) {
    const requerimento = await this.prisma.requerimento.findUnique({
      where: { id },
      include: {
        usuario: true,
        destinatario: true,
        etapa: true,
      },
    });

    if (!requerimento) {
      throw new NotFoundException('Requerimento não encontrado');
    }

    // Verificar se o usuário tem permissão para ver este requerimento
    if (requerimento.usuarioId !== usuarioId && requerimento.destinatarioId !== usuarioId) {
      throw new BadRequestException('Você não tem permissão para visualizar este requerimento');
    }

    // Se for tipo COMPRA, buscar as compras relacionadas
    if (requerimento.tipo === 'COMPRA') {
      // Buscar compras criadas pelo mesmo usuário em uma janela de 1 hora
      // Como não há relação direta, vamos buscar por solicitadoPorId e data próxima
      const dataInicio = new Date(requerimento.dataCriacao);
      dataInicio.setMinutes(dataInicio.getMinutes() - 30); // 30 minutos antes
      const dataFim = new Date(requerimento.dataCriacao);
      dataFim.setMinutes(dataFim.getMinutes() + 30); // 30 minutos depois

      const whereClause: any = {
        solicitadoPorId: requerimento.usuarioId,
        dataSolicitacao: {
          gte: dataInicio,
          lte: dataFim,
        },
      };

      // Se houver etapaId, incluir na busca para maior precisão
      if (requerimento.etapaId) {
        whereClause.etapaId = requerimento.etapaId;
      }

      const compras = await this.prisma.compra.findMany({
        where: whereClause,
        include: {
          categoria: true,
          projeto: true,
          etapa: true,
        },
        orderBy: { dataSolicitacao: 'asc' },
      });

      return {
        ...requerimento,
        compras,
      };
    }

    return requerimento;
  }

  async respond(id: number, usuarioId: number, data: RespondRequestDto) {
    const request = await this.prisma.requerimento.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Requerimento não encontrado');
    }

    if (request.destinatarioId !== usuarioId) {
      throw new BadRequestException('Somente o destinatário pode responder o requerimento');
    }

    return this.prisma.requerimento.update({
      where: { id },
      data: {
        resposta: data.resposta,
        anexoResposta: data.anexoResposta,
        status: 'respondida',
        dataResposta: new Date(),
      },
    });
  }

  async remove(id: number, usuarioId: number) {
    const requerimento = await this.prisma.requerimento.findUnique({
      where: { id },
    });

    if (!requerimento) {
      throw new NotFoundException('Requerimento não encontrado');
    }

    // Verificar se o usuário tem permissão para deletar
    // Apenas o remetente ou o destinatário podem deletar
    if (requerimento.usuarioId !== usuarioId && requerimento.destinatarioId !== usuarioId) {
      throw new BadRequestException('Você não tem permissão para deletar este requerimento');
    }

    return this.prisma.requerimento.delete({
      where: { id },
    });
  }

  private async ensureTaskExists(id: number) {
    const task = await this.prisma.etapa.findUnique({ where: { id } });
    if (!task) {
      throw new BadRequestException('Etapa informada não existe');
    }
  }
}
