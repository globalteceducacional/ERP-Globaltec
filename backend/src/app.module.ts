import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CargosModule } from './modules/cargos/cargos.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { StockModule } from './modules/stock/stock.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CargosModule,
    ProjectsModule,
    TasksModule,
    StockModule,
    NotificationsModule,
    OccurrencesModule,
    RequestsModule,
    SuppliersModule,
    CategoriesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
