import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RespondRequestDto } from './dto/respond-request.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: number, data: CreateRequestDto) {
    if (data.etapaId) {
      await this.ensureTaskExists(data.etapaId);
    }

    return this.prisma.requerimento.create({
      data: {
        usuarioId,
        destinatarioId: data.destinatarioId,
        etapaId: data.etapaId,
        texto: data.texto,
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

  listReceived(usuarioId: number) {
    return this.prisma.requerimento.findMany({
      where: { destinatarioId: usuarioId },
      orderBy: { dataCriacao: 'desc' },
      include: { usuario: true, etapa: true },
    });
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

  private async ensureTaskExists(id: number) {
    const task = await this.prisma.etapa.findUnique({ where: { id } });
    if (!task) {
      throw new BadRequestException('Etapa informada não existe');
    }
  }
}
