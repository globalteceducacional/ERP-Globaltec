import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: number, unreadOnly = false) {
    return this.prisma.notificacao.findMany({
      where: {
        usuarioId: userId,
        lida: unreadOnly ? false : undefined,
      },
      orderBy: { dataCriacao: 'desc' },
      include: {
        requerimento: true, // Incluir o requerimento linkado
      },
    });
  }

  async create(data: CreateNotificationDto) {
    return this.prisma.notificacao.create({
      data: {
        usuarioId: data.usuarioId,
        titulo: data.titulo,
        mensagem: data.mensagem,
        tipo: data.tipo,
        requerimentoId: data.requerimentoId, // Link para o requerimento
      },
    });
  }

  markAsRead(id: number) {
    return this.prisma.notificacao.update({
      where: { id },
      data: { lida: true },
    });
  }

  markAllAsRead(userId: number) {
    return this.prisma.notificacao.updateMany({
      where: { usuarioId: userId, lida: false },
      data: { lida: true },
    });
  }
}
