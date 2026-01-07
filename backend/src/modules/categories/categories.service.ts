import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.categoriaCompra.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  async findAllIncludingInactive() {
    return this.prisma.categoriaCompra.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: number) {
    const categoria = await this.prisma.categoriaCompra.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException(`Categoria com ID ${id} não encontrada`);
    }

    return categoria;
  }

  async create(data: CreateCategoryDto) {
    // Verificar se nome já existe
    const existingCategory = await this.prisma.categoriaCompra.findUnique({
      where: { nome: data.nome },
    });

    if (existingCategory) {
      throw new BadRequestException('Já existe uma categoria com este nome');
    }

    return this.prisma.categoriaCompra.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        ativo: data.ativo ?? true,
      },
    });
  }

  async update(id: number, data: UpdateCategoryDto) {
    const categoria = await this.findOne(id);

    // Se estiver atualizando o nome, verificar se já existe
    if (data.nome && data.nome !== categoria.nome) {
      const existingCategory = await this.prisma.categoriaCompra.findUnique({
        where: { nome: data.nome },
      });

      if (existingCategory) {
        throw new BadRequestException('Já existe uma categoria com este nome');
      }
    }

    return this.prisma.categoriaCompra.update({
      where: { id },
      data: {
        ...data,
        dataAtualizacao: new Date(),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Verificar se há compras usando esta categoria
    const comprasComCategoria = await this.prisma.compra.count({
      where: { categoriaId: id },
    });

    if (comprasComCategoria > 0) {
      throw new BadRequestException(
        `Não é possível excluir esta categoria. Existem ${comprasComCategoria} compra(s) vinculada(s) a ela. Desative a categoria ao invés de excluí-la.`,
      );
    }

    return this.prisma.categoriaCompra.delete({
      where: { id },
    });
  }

  async toggleActive(id: number) {
    const categoria = await this.findOne(id);

    return this.prisma.categoriaCompra.update({
      where: { id },
      data: {
        ativo: !categoria.ativo,
        dataAtualizacao: new Date(),
      },
    });
  }
}
