import { Module } from '@nestjs/common';
import { PcloudController } from './pcloud.controller';
import { PcloudService } from './pcloud.service';
import { upload_Pcloud } from 'src/upload_pcloud.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  // imports: [upload_Pcloud],
  controllers: [PcloudController],
  providers: [PcloudService,upload_Pcloud,PrismaService]
})
export class PcloudModule {}
