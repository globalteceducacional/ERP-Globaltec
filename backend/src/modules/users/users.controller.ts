import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('DIRETOR')
  findAll(@Query() filter: FilterUsersDto) {
    return this.usersService.findAll(filter);
  }

  @Get('options')
  findOptions() {
    return this.usersService.findOptions();
  }

  @Post()
  @Roles('DIRETOR')
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('DIRETOR')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    return this.usersService.update(id, body);
  }

  @Patch(':id/activate')
  @Roles('DIRETOR')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @Roles('DIRETOR')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/role')
  @Roles('DIRETOR')
  assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRoleDto,
  ) {
    return this.usersService.assignRole(id, body.cargoId);
  }

  @Delete(':id')
  @Roles('DIRETOR')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Patch('me/password')
  changePassword(@CurrentUser() user: { userId: number }, @Body() body: ChangePasswordDto) {
    return this.usersService.changePassword(user.userId, body.senhaAtual, body.novaSenha);
  }
}
