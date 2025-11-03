import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { StockModule } from './modules/stock/stock.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { RequestsModule } from './modules/requests/requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    StockModule,
    NotificationsModule,
    OccurrencesModule,
    RequestsModule,
  ],
})
export class AppModule {}
