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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GalpaoService } from './galpao.service';
import { CreateGalpaoProdutoDto } from './dto/create-galpao-produto.dto';
import { UpdateGalpaoProdutoDto } from './dto/update-galpao-produto.dto';
import { EntradaGalpaoLivroDto } from './dto/entrada-galpao-livro.dto';
import { AlocarGalpaoLivroDto } from './dto/alocar-galpao-livro.dto';
import { BaixaGalpaoLivroDto } from './dto/baixa-galpao-livro.dto';
import { AvariaGalpaoLivroDto } from './dto/avaria-galpao-livro.dto';
import { AlocarGalpaoOutroItemDto } from './dto/alocar-galpao-outro-item.dto';
import { EntradaGalpaoOutroItemDto } from './dto/entrada-galpao-outro-item.dto';
import { BaixaGalpaoOutroItemDto } from './dto/baixa-galpao-outro-item.dto';
import { AvariaGalpaoOutroItemDto } from './dto/avaria-galpao-outro-item.dto';

@Controller('galpao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GalpaoController {
  constructor(private readonly galpaoService: GalpaoService) {}

  @Get('produtos')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listProdutos(@Query('search') search?: string) {
    return this.galpaoService.listProdutos({ search });
  }

  @Post('produtos')
  @Permissions('estoque:movimentar')
  createProduto(
    @Body() dto: CreateGalpaoProdutoDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.galpaoService.createProduto(dto, user.userId);
  }

  @Patch('produtos/:id')
  @Permissions('estoque:movimentar')
  updateProduto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGalpaoProdutoDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.galpaoService.updateProduto(id, dto, user.userId);
  }

  @Delete('produtos/:id')
  @Permissions('estoque:movimentar')
  deleteProduto(@Param('id', ParseIntPipe) id: number) {
    return this.galpaoService.deleteProduto(id);
  }

  // ── Livros (compartilhados) ───────────────────────────────────────────────

  @Get('produtos/:id/livros-disponiveis')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listLivrosDisponiveis(
    @Param('id', ParseIntPipe) produtoId: number,
    @Query('search') search?: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    const categoriaIdNumber = categoriaId ? Number(categoriaId) : undefined;
    return this.galpaoService.listLivrosDisponiveis({
      produtoId,
      search,
      categoriaId: Number.isFinite(categoriaIdNumber as number) ? categoriaIdNumber : undefined,
    });
  }

  @Get('livros-disponiveis')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listLivrosDisponiveisGlobal(
    @Query('search') search?: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    const categoriaIdNumber = categoriaId ? Number(categoriaId) : undefined;
    return this.galpaoService.listLivrosDisponiveis({
      search,
      categoriaId: Number.isFinite(categoriaIdNumber as number) ? categoriaIdNumber : undefined,
    });
  }

  @Get('produtos/:id/livros-reservados')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listLivrosReservados(@Param('id', ParseIntPipe) produtoId: number) {
    return this.galpaoService.listLivrosReservados(produtoId);
  }

  @Get('livros-disponiveis-por-fornecedor')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listLivrosDisponiveisPorFornecedor(
    @Query('isbn') isbn: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    const categoriaIdNumber = categoriaId ? Number(categoriaId) : undefined;
    return this.galpaoService.listLivrosDisponiveisPorFornecedor({
      isbn,
      categoriaId: Number.isFinite(categoriaIdNumber as number) ? categoriaIdNumber : undefined,
    });
  }

  @Post('produtos/:id/livros/entrada')
  @Permissions('estoque:movimentar')
  entradaLivros(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: EntradaGalpaoLivroDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.galpaoService.entradaLivros(produtoId, dto, user.userId);
  }

  @Post('produtos/:id/livros/alocar')
  @Permissions('estoque:movimentar')
  alocarLivros(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: AlocarGalpaoLivroDto,
  ) {
    return this.galpaoService.alocarLivros(produtoId, dto);
  }

  @Post('produtos/:id/livros/baixa')
  @Permissions('estoque:movimentar')
  baixarLivros(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: BaixaGalpaoLivroDto,
  ) {
    return this.galpaoService.baixarLivros(produtoId, dto);
  }

  @Post('produtos/:id/livros/avaria')
  @Permissions('estoque:movimentar')
  avariaLivros(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: AvariaGalpaoLivroDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.galpaoService.avariaLivros(produtoId, dto, user.userId);
  }

  // Avaria de livros causada no transporte/armazenagem (não depende de produto do galpão)
  @Post('livros/avaria')
  @Permissions('estoque:movimentar')
  avariaLivrosGlobal(
    @Body() dto: AvariaGalpaoLivroDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.galpaoService.avariaLivros(null, dto, user.userId);
  }

  @Get('livros/avarias')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listLivroAvarias(
    @Query('isbn') isbn: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    const categoriaIdNumber = categoriaId ? Number(categoriaId) : undefined;
    return this.galpaoService.listLivroAvarias({
      isbn,
      categoriaId: Number.isFinite(categoriaIdNumber as number) ? categoriaIdNumber : undefined,
    });
  }

  @Delete('livros-disponiveis/:isbn')
  @Permissions('estoque:movimentar')
  deleteLivroCadastro(
    @Param('isbn') isbn: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    const categoriaIdNumber = categoriaId ? Number(categoriaId) : undefined;
    return this.galpaoService.deleteLivroCadastro({
      isbn,
      categoriaId: Number.isFinite(categoriaIdNumber as number) ? categoriaIdNumber : undefined,
    });
  }

  // ── Outros itens ──────────────────────────────────────────────────────────

  @Get('produtos/:id/outros-itens-disponiveis')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listOutrosItensDisponiveis(
    @Param('id', ParseIntPipe) produtoId: number,
    @Query('search') search?: string,
  ) {
    return this.galpaoService.listOutrosItensDisponiveis({ produtoId, search });
  }

  @Get('outros-itens-disponiveis')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listOutrosItensDisponiveisGlobal(@Query('search') search?: string) {
    return this.galpaoService.listOutrosItensDisponiveis({ search });
  }

  @Get('produtos/:id/outros-itens-alocados')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listOutrosItensAlocados(@Param('id', ParseIntPipe) produtoId: number) {
    return this.galpaoService.listOutrosItensAlocados(produtoId);
  }

  @Post('produtos/:id/outros-itens/entrada')
  @Permissions('estoque:movimentar')
  entradaOutroItem(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: EntradaGalpaoOutroItemDto,
  ) {
    return this.galpaoService.entradaOutroItem(produtoId, dto);
  }

  @Post('produtos/:id/outros-itens/alocar')
  @Permissions('estoque:movimentar')
  alocarOutroItem(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: AlocarGalpaoOutroItemDto,
  ) {
    return this.galpaoService.alocarOutroItem(produtoId, dto);
  }

  @Post('produtos/:id/outros-itens/baixa')
  @Permissions('estoque:movimentar')
  baixarOutroItem(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: BaixaGalpaoOutroItemDto,
  ) {
    return this.galpaoService.baixarOutroItem(produtoId, dto);
  }

  @Post('produtos/:id/outros-itens/avaria')
  @Permissions('estoque:movimentar')
  avariaOutroItem(
    @Param('id', ParseIntPipe) produtoId: number,
    @Body() dto: AvariaGalpaoOutroItemDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.galpaoService.avariaOutroItem(produtoId, dto, user.userId);
  }

  @Get('outros-itens/:estoqueId/avarias')
  @Permissions('estoque:visualizar', 'estoque:movimentar')
  listAvariasOutroItem(@Param('estoqueId', ParseIntPipe) estoqueId: number) {
    return this.galpaoService.listAvariasOutroItem(estoqueId);
  }

  @Delete('outros-itens/:estoqueId')
  @Permissions('estoque:movimentar')
  deleteOutroItemCadastro(@Param('estoqueId', ParseIntPipe) estoqueId: number) {
    return this.galpaoService.deleteOutroItemCadastro(estoqueId);
  }
}

