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
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { ProjectsImportService } from './projects-import.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateResponsiblesDto } from './dto/update-responsibles.dto';
import { ReorderEtapasDto } from './dto/reorder-etapas.dto';
import { DeleteAbaDto, RenameAbaDto } from './dto/update-aba.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ProjetoStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';

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
}
