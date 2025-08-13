import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PcloudModule } from './pcloud/pcloud.module';
import { WebSocketService } from './websocket.service';
import { PrismaService } from './prisma.service';
// import { WebSocketService } from './websocket.service';
// import { WebSocketService } from './websocket.service';



@Module({
  imports: [PcloudModule],
  controllers: [AppController],
  providers: [AppService,WebSocketService,PrismaService],
})
export class AppModule {}
