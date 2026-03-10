import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { ProjectsImportService } from './projects-import.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateResponsiblesDto } from './dto/update-responsibles.dto';
import { ReorderEtapasDto } from './dto/reorder-etapas.dto';
import { DeleteAbaDto, RenameAbaDto } from './dto/update-aba.dto';
import { CreateSessaoDto } from './dto/create-sessao.dto';
import { UpdateSessaoDto } from './dto/update-sessao.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ProjetoStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { join, extname } from 'path';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectsImportService: ProjectsImportService,
  ) {}

  @Get('options')
  listOptions() {
    return this.projectsService.listOptions();
  }

  @Get()
  @Permissions('projetos:visualizar', 'projetos:editar', 'projetos:aprovar')
  findAll(
    @Query('status') status?: ProjetoStatus,
    @Query('search') search?: string,
  ) {
    return this.projectsService.findAll({ status, search });
  }

  @Get('export')
  @Permissions('projetos:visualizar', 'projetos:editar', 'projetos:aprovar')
  async export(@Res() res: Response) {
    const buffer = await this.projectsImportService.exportToExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="projetos.xlsx"',
    );
    res.send(buffer);
  }

  @Get(':id/export')
  @Permissions('projetos:visualizar', 'projetos:editar', 'projetos:aprovar')
  async exportOne(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.projectsImportService.exportToExcel(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="projeto-${id}.xlsx"`,
    );
    res.send(buffer);
  }

  @Post(':id/sessoes')
  @Permissions('projetos:editar')
  createSessao(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSessaoDto,
  ) {
    return this.projectsService.createSessao(id, body);
  }

  @Patch(':id/sessoes/:sessaoId')
  @Permissions('projetos:editar')
  updateSessao(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessaoId', ParseIntPipe) sessaoId: number,
    @Body() body: UpdateSessaoDto,
  ) {
    return this.projectsService.updateSessao(id, sessaoId, body);
  }

  @Delete(':id/sessoes/:sessaoId')
  @Permissions('projetos:editar')
  @HttpCode(204)
  deleteSessao(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessaoId', ParseIntPipe) sessaoId: number,
  ) {
    return this.projectsService.deleteSessao(id, sessaoId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @Permissions('projetos:editar')
  create(@Body() body: CreateProjectDto) {
    return this.projectsService.create(body);
  }

  @Patch(':id')
  @Permissions('projetos:editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProjectDto) {
    // Debug: verificar se descricaoArquivos está chegando no controller
    // eslint-disable-next-line no-console
    console.log('[ProjectsController] update body.descricaoArquivos', {
      id,
      hasDescricaoArquivos: !!body.descricaoArquivos,
      isArray: Array.isArray(body.descricaoArquivos),
      length: Array.isArray(body.descricaoArquivos)
        ? body.descricaoArquivos.length
        : null,
    });
    return this.projectsService.update(id, body);
  }

  @Patch(':id/responsibles')
  @Permissions('projetos:editar')
  updateResponsibles(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateResponsiblesDto,
  ) {
    return this.projectsService.updateResponsibles(id, body);
  }

  @Patch(':id/etapas/reorder')
  @Permissions('projetos:editar')
  reorderEtapas(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReorderEtapasDto,
  ) {
    return this.projectsService.reorderEtapas(id, body);
  }

  @Patch(':id/abas/rename')
  @Permissions('projetos:editar')
  renameAba(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RenameAbaDto,
  ) {
    return this.projectsService.renameAba(id, body);
  }

  @Patch(':id/abas/delete')
  @Permissions('projetos:editar')
  deleteAba(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeleteAbaDto,
  ) {
    return this.projectsService.deleteAba(id, body);
  }

  @Patch(':id/finalize')
  @Permissions('projetos:editar', 'projetos:aprovar')
  finalize(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.finalize(id);
  }

  @Delete(':id')
  @Permissions('projetos:editar')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }

  @Post('import')
  @Permissions('projetos:editar')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: number },
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    // Validar extensão do arquivo
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException('Formato de arquivo inválido. Use .xlsx ou .xls');
    }

    return this.projectsImportService.importFromExcel(
      file.buffer,
      user.userId,
    );
  }
  /**
   * Novo fluxo de anexos de projeto:
   * - Upload já vincula diretamente no projeto (campo descricaoArquivos).
   * - O frontend NÃO precisa mais mandar descricaoArquivos no PATCH/POST do projeto.
   */

  @Post(':id/descricao-files')
  @Permissions('projetos:editar')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads', 'projects');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const random = Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname) || '';
          cb(null, `${timestamp}-${random}${ext}`);
        },
      }),
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB por arquivo
        files: 10,
      },
    }),
  )
  async uploadDescricaoFiles(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.projectsService.addDescricaoArquivos(id, files);
  }

  @Delete(':id/descricao-files')
  @Permissions('projetos:editar')
  async deleteDescricaoFile(
    @Param('id', ParseIntPipe) id: number,
    @Body('url') url: string,
  ) {
    return this.projectsService.removeDescricaoArquivo(id, url);
  }
}
