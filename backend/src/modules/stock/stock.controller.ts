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
} from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompraStatus, EstoqueStatus } from '@prisma/client';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { UpdatePurchaseStatusDto } from './dto/update-purchase-status.dto';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRETOR', 'COTADOR', 'PAGADOR')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('items')
  listItems(
    @Query('status') status?: EstoqueStatus,
    @Query('search') search?: string,
  ) {
    return this.stockService.listItems({ status, search });
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
  ) {
    return this.stockService.listPurchases({ status, projetoId: projetoId ? Number(projetoId) : undefined });
  }

  @Post('purchases')
  createPurchase(@Body() body: CreatePurchaseDto) {
    return this.stockService.createPurchase(body);
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
}
