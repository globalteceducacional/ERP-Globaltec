import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateResponsiblesDto } from './dto/update-responsibles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Cargo, ProjetoStatus } from '@prisma/client';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Roles(Cargo.DIRETOR)
  findAll(
    @Query('status') status?: ProjetoStatus,
    @Query('search') search?: string,
  ) {
    return this.projectsService.findAll({ status, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @Roles(Cargo.DIRETOR)
  create(@Body() body: CreateProjectDto) {
    return this.projectsService.create(body);
  }

  @Patch(':id')
  @Roles(Cargo.DIRETOR)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProjectDto) {
    return this.projectsService.update(id, body);
  }

  @Patch(':id/responsibles')
  @Roles(Cargo.DIRETOR)
  updateResponsibles(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateResponsiblesDto,
  ) {
    return this.projectsService.updateResponsibles(id, body);
  }

  @Patch(':id/finalize')
  @Roles(Cargo.DIRETOR)
  finalize(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.finalize(id);
  }
}
