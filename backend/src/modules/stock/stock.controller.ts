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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompraStatus, EstoqueStatus } from '@prisma/client';
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
@Roles('DIRETOR', 'COTADOR', 'PAGADOR')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('items')
  listItems(
    @Query('status') status?: EstoqueStatus,
    @Query('search') search?: string,
    @Query('projetoId') projetoId?: string,
    @Query('etapaId') etapaId?: string,
  ) {
    return this.stockService.listItems({ 
      status, 
      search,
      projetoId: projetoId ? Number(projetoId) : undefined,
      etapaId: etapaId ? Number(etapaId) : undefined,
    });
  }

  @Post('items')
  createItem(@Body() body: CreateStockItemDto) {
    return this.stockService.createItem(body);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStockItemDto,
  ) {
    return this.stockService.updateItem(id, body);
  }

  @Delete('items/:id')
  deleteItem(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteItem(id);
  }

  @Get('purchases')
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
  createPurchase(@CurrentUser() user: { userId: number }, @Body() body: CreatePurchaseDto) {
    return this.stockService.createPurchase(body, user.userId);
  }

  @Patch('purchases/:id/status')
  updatePurchaseStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePurchaseStatusDto,
  ) {
    return this.stockService.updatePurchaseStatus(id, body);
  }

  @Patch('purchases/:id')
  updatePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePurchaseDto,
  ) {
    return this.stockService.updatePurchase(id, body);
  }

  @Delete('purchases/:id')
  deletePurchase(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deletePurchase(id);
  }

  @Post('purchases/:id/approve')
  approvePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApprovePurchaseDto,
  ) {
    return this.stockService.approvePurchase(id, body);
  }

  @Post('purchases/:id/reject')
  rejectPurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectPurchaseDto,
  ) {
    return this.stockService.rejectPurchase(id, body.motivoRejeicao);
  }

  @Post('alocacoes')
  createAlocacao(@Body() body: CreateAlocacaoDto) {
    return this.stockService.createAlocacao(body);
  }

  @Get('alocacoes')
  listAlocacoes(
    @Query('estoqueId') estoqueId?: string,
    @Query('projetoId') projetoId?: string,
    @Query('etapaId') etapaId?: string,
  ) {
    return this.stockService.listAlocacoes(
      estoqueId ? Number(estoqueId) : undefined,
      projetoId ? Number(projetoId) : undefined,
      etapaId ? Number(etapaId) : undefined,
    );
  }

  @Patch('alocacoes/:id')
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
  deleteAlocacao(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteAlocacao(id);
  }
}
