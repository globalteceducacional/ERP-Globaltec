import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { SetoresService } from './setores.service';
import { CreateSetorDto } from './dto/create-setor.dto';
import { UpdateSetorDto } from './dto/update-setor.dto';
import { UpdateSetorMembersDto } from './dto/update-setor-members.dto';

@Controller('setores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SetoresController {
  constructor(private readonly setoresService: SetoresService) {}

  @Get('options')
  @Permissions(
    'setores:visualizar',
    'setores:gerenciar',
    'projetos:editar',
    'compras:solicitar',
    'compras:aprovar',
    'curadoria:gerenciar',
  )
  listOptions() {
    return this.setoresService.listOptions();
  }

  @Get()
  @Permissions('setores:visualizar', 'setores:gerenciar')
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.setoresService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Permissions('setores:visualizar', 'setores:gerenciar')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.setoresService.findOne(id);
  }

  @Post()
  @Permissions('setores:gerenciar')
  create(@Body() body: CreateSetorDto) {
    return this.setoresService.create(body);
  }

  @Patch(':id')
  @Permissions('setores:gerenciar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSetorDto) {
    return this.setoresService.update(id, body);
  }

  @Patch(':id/members')
  @Permissions('setores:gerenciar')
  updateMembers(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSetorMembersDto,
  ) {
    return this.setoresService.updateMembers(id, body.userIds);
  }

  @Delete(':id')
  @Permissions('setores:gerenciar')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.setoresService.remove(id);
  }
}

