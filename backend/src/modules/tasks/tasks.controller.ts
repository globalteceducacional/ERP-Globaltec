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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { FilterMyTasksDto } from './dto/filter-my-tasks.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto';
import { ReviewDeliveryDto } from './dto/review-delivery.dto';
import { SubmitChecklistItemDto } from './dto/submit-checklist-item.dto';
import { ReviewChecklistItemDto } from './dto/review-checklist-item.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('my')
  findMyTasks(@CurrentUser() user: { userId: number }, @Query() filter: FilterMyTasksDto) {
    return this.tasksService.listMyTasks(user.userId, filter);
  }

  @Post()
  @Roles('DIRETOR', 'SUPERVISOR')
  create(@Body() body: CreateTaskDto) {
    return this.tasksService.create(body);
  }

  @Patch(':id')
  @Roles('DIRETOR', 'SUPERVISOR')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.tasksService.update(id, body);
  }

  @Patch(':id/status')
  @Roles('DIRETOR', 'SUPERVISOR')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangeTaskStatusDto,
  ) {
    return this.tasksService.changeStatus(id, body);
  }

  @Post(':id/deliver')
  @Roles('EXECUTOR', 'SUPERVISOR', 'DIRETOR')
  deliver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: SubmitDeliveryDto,
  ) {
    return this.tasksService.deliver(id, user.userId, body);
  }

  @Patch(':id/deliver/:entregaId')
  @Roles('EXECUTOR', 'SUPERVISOR', 'DIRETOR')
  updateDelivery(
    @Param('id', ParseIntPipe) etapaId: number,
    @Param('entregaId', ParseIntPipe) entregaId: number,
    @CurrentUser() user: { userId: number },
    @Body() body: SubmitDeliveryDto,
  ) {
    return this.tasksService.updateDelivery(etapaId, entregaId, user.userId, body);
  }

  @Post(':id/approve')
  @Roles('DIRETOR', 'SUPERVISOR')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: ReviewDeliveryDto,
  ) {
    return this.tasksService.approve(id, user.userId, body.comentario);
  }

  @Post(':id/reject')
  @Roles('DIRETOR', 'SUPERVISOR')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: RejectTaskDto,
  ) {
    return this.tasksService.reject(id, user.userId, body.reason);
  }

  @Post(':id/subtasks')
  @Roles('EXECUTOR', 'SUPERVISOR', 'DIRETOR')
  createSubtask(
    @Param('id', ParseIntPipe) etapaId: number,
    @Body() body: CreateSubtaskDto,
  ) {
    return this.tasksService.createSubtask({ ...body, etapaId });
  }

  @Patch(':id/subtasks/:subtaskId')
  @Roles('EXECUTOR', 'SUPERVISOR', 'DIRETOR')
  updateSubtask(
    @Param('subtaskId', ParseIntPipe) subtaskId: number,
    @Body() body: UpdateSubtaskDto,
  ) {
    return this.tasksService.updateSubtask(subtaskId, body);
  }

  @Patch(':id/checklist')
  // Sem restrição de @Roles - a validação é feita no service verificando se é executor ou integrante
  updateChecklist(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: UpdateChecklistDto,
  ) {
    return this.tasksService.updateChecklist(id, user.userId, body.checklist);
  }

  @Post(':id/checklist/:index/submit')
  // Sem restrição de @Roles - a validação é feita no service
  submitChecklistItem(
    @Param('id', ParseIntPipe) etapaId: number,
    @Param('index', ParseIntPipe) checklistIndex: number,
    @CurrentUser() user: { userId: number },
    @Body() body: SubmitChecklistItemDto,
  ) {
    return this.tasksService.submitChecklistItem(etapaId, checklistIndex, user.userId, body);
  }

  @Patch(':id/checklist/:index/review')
  @Roles('DIRETOR', 'SUPERVISOR', 'GM')
  reviewChecklistItem(
    @Param('id', ParseIntPipe) etapaId: number,
    @Param('index', ParseIntPipe) checklistIndex: number,
    @CurrentUser() user: { userId: number },
    @Body() body: ReviewChecklistItemDto,
  ) {
    return this.tasksService.reviewChecklistItem(etapaId, checklistIndex, user.userId, body);
  }

  @Delete(':id/subtasks/:subtaskId')
  @Roles('EXECUTOR', 'SUPERVISOR', 'DIRETOR')
  deleteSubtask(@Param('subtaskId', ParseIntPipe) subtaskId: number) {
    return this.tasksService.deleteSubtask(subtaskId);
  }
}
