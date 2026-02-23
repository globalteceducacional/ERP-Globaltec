import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompraStatus } from '@prisma/client';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';
import { ApprovePurchaseDto } from './dto/approve-purchase.dto';
import { RejectPurchaseDto } from './dto/reject-purchase.dto';
import { CreateAlocacaoDto } from './dto/create-alocacao.dto';
import { UpdateAlocacaoDto } from './dto/update-alocacao.dto';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ── Estoque ──────────────────────────────────────────────────────────────

  @Get('items')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listItems(@Query('search') search?: string) {
    return this.stockService.listItems({ search });
  }

  @Post('items')
  @Permissions('estoque:movimentar')
  createItem(@Body() body: CreateStockItemDto) {
    return this.stockService.createItem(body);
  }

  @Patch('items/:id')
  @Permissions('estoque:movimentar')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStockItemDto,
  ) {
    return this.stockService.updateItem(id, body);
  }

  @Delete('items/:id')
  @Permissions('estoque:movimentar')
  deleteItem(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteItem(id);
  }

  // ── Compras ───────────────────────────────────────────────────────────────

  @Get('purchases')
  @Permissions('compras:solicitar', 'compras:aprovar')
  listPurchases(
    @Query('status') status?: CompraStatus,
    @Query('projetoId') projetoId?: string,
    @Query('etapaId') etapaId?: string,
    @Query('excludeSolicitado') excludeSolicitado?: string,
  ) {
    return this.stockService.listPurchases({
      status,
      projetoId: projetoId ? Number(projetoId) : undefined,
      etapaId: etapaId ? Number(etapaId) : undefined,
      excludeSolicitado: excludeSolicitado === 'true',
    });
  }

  @Post('purchases')
  @Permissions('compras:solicitar', 'compras:aprovar')
  createPurchase(
    @CurrentUser() user: { userId: number },
    @Body() body: CreatePurchaseDto,
  ) {
    return this.stockService.createPurchase(body, user.userId);
  }

  @Patch('purchases/:id/status')
  @Permissions('compras:aprovar')
  updatePurchaseStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePurchaseStatusDto,
  ) {
    return this.stockService.updatePurchaseStatus(id, body);
  }

  @Patch('purchases/:id')
  @Permissions('compras:solicitar', 'compras:aprovar')
  updatePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePurchaseDto,
  ) {
    return this.stockService.updatePurchase(id, body);
  }

  @Delete('purchases/:id')
  @Permissions('compras:solicitar', 'compras:aprovar')
  deletePurchase(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deletePurchase(id);
  }

  @Post('purchases/:id/approve')
  @Permissions('compras:aprovar')
  approvePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApprovePurchaseDto,
  ) {
    return this.stockService.approvePurchase(id, body);
  }

  @Post('purchases/:id/reject')
  @Permissions('compras:aprovar')
  rejectPurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectPurchaseDto,
  ) {
    return this.stockService.rejectPurchase(id, body.motivoRejeicao);
  }

  // ── Alocações ─────────────────────────────────────────────────────────────

  @Post('alocacoes')
  @Permissions('estoque:movimentar', 'estoque:visualizar')
  createAlocacao(@Body() body: CreateAlocacaoDto) {
    return this.stockService.createAlocacao(body);
  }

  @Get('alocacoes')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listAlocacoes(
    @Query('estoqueId') estoqueId?: string,
    @Query('projetoId') projetoId?: string,
    @Query('etapaId') etapaId?: string,
    @Query('usuarioId') usuarioId?: string,
  ) {
    return this.stockService.listAlocacoes(
      estoqueId ? Number(estoqueId) : undefined,
      projetoId ? Number(projetoId) : undefined,
      etapaId ? Number(etapaId) : undefined,
      usuarioId ? Number(usuarioId) : undefined,
    );
  }

  @Patch('alocacoes/:id')
  @Permissions('estoque:movimentar')
  updateAlocacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAlocacaoDto,
  ) {
    if (!body.quantidade) {
      throw new BadRequestException('Quantidade é obrigatória');
    }
    return this.stockService.updateAlocacao(id, body.quantidade);
  }

  @Delete('alocacoes/:id')
  @Permissions('estoque:movimentar')
  deleteAlocacao(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteAlocacao(id);
  }
}
