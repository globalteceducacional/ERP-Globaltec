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
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Cargo } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { FilterMyTasksDto } from './dto/filter-my-tasks.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { RejectTaskDto } from './dto/reject-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('my')
  findMyTasks(@CurrentUser() user: { userId: number }, @Query() filter: FilterMyTasksDto) {
    return this.tasksService.listMyTasks(user.userId, filter);
  }

  @Post()
  @Roles(Cargo.DIRETOR, Cargo.SUPERVISOR)
  create(@Body() body: CreateTaskDto) {
    return this.tasksService.create(body);
  }

  @Patch(':id')
  @Roles(Cargo.DIRETOR, Cargo.SUPERVISOR)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.tasksService.update(id, body);
  }

  @Patch(':id/status')
  @Roles(Cargo.DIRETOR, Cargo.SUPERVISOR)
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangeTaskStatusDto,
  ) {
    return this.tasksService.changeStatus(id, body);
  }

  @Post(':id/deliver')
  @Roles(Cargo.EXECUTOR, Cargo.SUPERVISOR, Cargo.DIRETOR)
  deliver(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { userId: number }) {
    return this.tasksService.deliver(id, user.userId);
  }

  @Post(':id/approve')
  @Roles(Cargo.DIRETOR, Cargo.SUPERVISOR)
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.approve(id);
  }

  @Post(':id/reject')
  @Roles(Cargo.DIRETOR, Cargo.SUPERVISOR)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectTaskDto,
  ) {
    return this.tasksService.reject(id, body.reason);
  }

  @Post(':id/subtasks')
  @Roles(Cargo.EXECUTOR, Cargo.SUPERVISOR, Cargo.DIRETOR)
  createSubtask(
    @Param('id', ParseIntPipe) etapaId: number,
    @Body() body: CreateSubtaskDto,
  ) {
    return this.tasksService.createSubtask({ ...body, etapaId });
  }

  @Patch(':id/subtasks/:subtaskId')
  @Roles(Cargo.EXECUTOR, Cargo.SUPERVISOR, Cargo.DIRETOR)
  updateSubtask(
    @Param('subtaskId', ParseIntPipe) subtaskId: number,
    @Body() body: UpdateSubtaskDto,
  ) {
    return this.tasksService.updateSubtask(subtaskId, body);
  }

  @Delete(':id/subtasks/:subtaskId')
  @Roles(Cargo.EXECUTOR, Cargo.SUPERVISOR, Cargo.DIRETOR)
  deleteSubtask(@Param('subtaskId', ParseIntPipe) subtaskId: number) {
    return this.tasksService.deleteSubtask(subtaskId);
  }
}
