import { Controller, Get, HttpException, HttpStatus, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { upload_Pcloud } from './upload_pcloud.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';

const memoryStorage = multer.memoryStorage();

// const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
//   const allowedFormats = ['jpg', 'jpeg', 'png'];
//   const fileFormat = file.originalname.split('.').pop().toLowerCase();

//   if (allowedFormats.includes(fileFormat)) {
//     cb(null, true);
//   } else {
//     cb(new HttpException('Invalid file format: Only jpg, jpeg, and png are allowed.', HttpStatus.BAD_REQUEST), false);
//   }
// };

@Controller()
export class AppController {
  // constructor(
  //   private readonly appService: AppService,
  //   private readonly pCloudService: PCloudService
  // ) {}

  @Get()
  getHello(): string {
    return 'asdasd';
  }
  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }

  // @Post()
  // @UseInterceptors(FileFieldsInterceptor(
  //   [
  //     { name: 'hinhAnh', maxCount: 1 },
  //     // thêm các field file khác nếu cần
  //   ], 
  //   {
  //     storage: memoryStorage,
  //     fileFilter: fileFilter,
  //   }
  // ))
  // async createRoom(
  //   @UploadedFiles() files: { hinhAnh?: Express.Multer.File[] },
  //   @Res() res: Response
  // ) {
  //   try {
  //     const avatarFiles = files.hinhAnh;
  //     if (avatarFiles && avatarFiles.length > 0) {
  //       const file = avatarFiles[0];
  //       const uploadResult = await this.pCloudService.uploadImageBufferToPCloud(file.buffer, file.originalname);
  //       return res.json(uploadResult);
  //     } else {
  //       return res.status(HttpStatus.BAD_REQUEST).json({ message: 'No file uploaded' });
  //     }
  //   } catch (error) {
  //     return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
  //       statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       message: error.message || 'Internal Server Error',
  //     });
  //   }
  // }
}
