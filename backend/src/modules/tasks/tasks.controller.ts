import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { Permissions } from '../../common/decorators/permissions.decorator';
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
  @Permissions('projetos:editar')
  create(@Body() body: CreateTaskDto) {
    return this.tasksService.create(body);
  }

  @Patch(':id')
  @Permissions('projetos:editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.tasksService.update(id, body);
  }

  @Patch(':id/status')
  @Permissions('projetos:editar', 'projetos:aprovar')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangeTaskStatusDto,
  ) {
    return this.tasksService.changeStatus(id, body);
  }

  @Post(':id/deliver')
  @Permissions('trabalhos:registrar', 'trabalhos:avaliar')
  deliver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: SubmitDeliveryDto,
  ) {
    return this.tasksService.deliver(id, user.userId, body);
  }

  @Patch(':id/deliver/:entregaId')
  @Permissions('trabalhos:registrar', 'trabalhos:avaliar')
  updateDelivery(
    @Param('id', ParseIntPipe) etapaId: number,
    @Param('entregaId', ParseIntPipe) entregaId: number,
    @CurrentUser() user: { userId: number },
    @Body() body: SubmitDeliveryDto,
  ) {
    return this.tasksService.updateDelivery(etapaId, entregaId, user.userId, body);
  }

  @Post(':id/approve')
  @Permissions('trabalhos:avaliar', 'projetos:aprovar')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: ReviewDeliveryDto,
  ) {
    return this.tasksService.approve(id, user.userId, body.comentario);
  }

  @Post(':id/reject')
  @Permissions('trabalhos:avaliar', 'projetos:aprovar')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: RejectTaskDto,
  ) {
    return this.tasksService.reject(id, user.userId, body.reason);
  }

  @Post(':id/subtasks')
  @Permissions('trabalhos:registrar', 'projetos:editar')
  createSubtask(
    @Param('id', ParseIntPipe) etapaId: number,
    @Body() body: CreateSubtaskDto,
  ) {
    return this.tasksService.createSubtask({ ...body, etapaId });
  }

  @Patch(':id/subtasks/:subtaskId')
  @Permissions('trabalhos:registrar', 'projetos:editar')
  updateSubtask(
    @Param('subtaskId', ParseIntPipe) subtaskId: number,
    @Body() body: UpdateSubtaskDto,
  ) {
    return this.tasksService.updateSubtask(subtaskId, body);
  }

  @Patch(':id/checklist')
  updateChecklist(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number },
    @Body() body: UpdateChecklistDto,
  ) {
    return this.tasksService.updateChecklist(id, user.userId, body.checklist);
  }

  @Post(':id/checklist/:index/submit')
  submitChecklistItem(
    @Param('id', ParseIntPipe) etapaId: number,
    @Param('index', ParseIntPipe) checklistIndex: number,
    @CurrentUser() user: { userId: number },
    @Body() body: SubmitChecklistItemDto,
    @Query('subitemIndex') subitemIndex?: string,
  ) {
    const subitemIndexNum = subitemIndex ? parseInt(subitemIndex, 10) : undefined;
    return this.tasksService.submitChecklistItem(etapaId, checklistIndex, user.userId, body, subitemIndexNum);
  }

  @Patch(':id/checklist/:index/review')
  @Permissions('trabalhos:avaliar', 'projetos:aprovar')
  reviewChecklistItem(
    @Param('id', ParseIntPipe) etapaId: number,
    @Param('index', ParseIntPipe) checklistIndex: number,
    @CurrentUser() user: { userId: number },
    @Body() body: ReviewChecklistItemDto,
    @Query('subitemIndex') subitemIndex?: string,
  ) {
    const subitemIndexNum = subitemIndex ? parseInt(subitemIndex, 10) : undefined;
    return this.tasksService.reviewChecklistItem(etapaId, checklistIndex, user.userId, body, subitemIndexNum);
  }

  @Delete(':id/subtasks/:subtaskId')
  @Permissions('trabalhos:registrar', 'projetos:editar')
  deleteSubtask(@Param('subtaskId', ParseIntPipe) subtaskId: number) {
    return this.tasksService.deleteSubtask(subtaskId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('projetos:editar')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
