import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CargosService } from './cargos.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('cargos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CargosController {
  constructor(private readonly cargosService: CargosService) {}

  @Get()
  findAll() {
    return this.cargosService.findAll();
  }

  @Get('all')
  findAllIncludingInactive() {
    return this.cargosService.findAllIncludingInactive();
  }

  @Get('permissions')
  @Permissions('usuarios:gerenciar')
  listPermissions() {
    return this.cargosService.listPermissions();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cargosService.findOne(id);
  }

  @Post()
  @Permissions('usuarios:gerenciar')
  create(@Body() body: CreateCargoDto) {
    return this.cargosService.create(body);
  }

  @Patch(':id')
  @Permissions('usuarios:gerenciar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCargoDto) {
    return this.cargosService.update(id, body);
  }

  @Delete(':id')
  @Permissions('usuarios:gerenciar')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cargosService.remove(id);
  }
}

