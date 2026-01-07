import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { razaoSocial: 'asc' },
    });
  }

  async findAllIncludingInactive() {
    return this.prisma.fornecedor.findMany({
      orderBy: { razaoSocial: 'asc' },
    });
  }

  async findOne(id: number) {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: { id },
    });

    if (!fornecedor) {
      throw new NotFoundException(`Fornecedor com ID ${id} não encontrado`);
    }

    return fornecedor;
  }

  async create(data: CreateSupplierDto) {
    // Verificar se CNPJ já existe
    const existingSupplier = await this.prisma.fornecedor.findUnique({
      where: { cnpj: data.cnpj },
    });

    if (existingSupplier) {
      throw new BadRequestException('CNPJ já cadastrado');
    }

    return this.prisma.fornecedor.create({
      data: {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpj: data.cnpj,
        endereco: data.endereco,
        contato: data.contato,
        ativo: data.ativo ?? true,
      },
    });
  }

  async update(id: number, data: UpdateSupplierDto) {
    const fornecedor = await this.findOne(id);

    // Se estiver atualizando o CNPJ, verificar se já existe
    if (data.cnpj && data.cnpj !== fornecedor.cnpj) {
      const existingSupplier = await this.prisma.fornecedor.findUnique({
        where: { cnpj: data.cnpj },
      });

      if (existingSupplier) {
        throw new BadRequestException('CNPJ já cadastrado');
      }
    }

    return this.prisma.fornecedor.update({
      where: { id },
      data: {
        ...data,
        dataAtualizacao: new Date(),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.fornecedor.delete({
      where: { id },
    });
  }

  async toggleActive(id: number) {
    const fornecedor = await this.findOne(id);

    return this.prisma.fornecedor.update({
      where: { id },
      data: {
        ativo: !fornecedor.ativo,
        dataAtualizacao: new Date(),
      },
    });
  }
}
