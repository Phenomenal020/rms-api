import { Module } from '@nestjs/common';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}
