import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PcloudModule } from './pcloud/pcloud.module';




// import { upload_Pcloud } from './upload_pcloud.service';
// import { PCloudService } from './upload.service';




@Module({
  imports: [PcloudModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
