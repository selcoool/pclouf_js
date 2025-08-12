import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UploadedFiles,
  UseInterceptors,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { upload_Pcloud } from 'src/upload_pcloud.service';

const memoryStorage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedFormats = ['jpg', 'jpeg', 'png'];
  const fileFormat = file.originalname.split('.').pop().toLowerCase();
  if (allowedFormats.includes(fileFormat)) cb(null, true);
  else cb(new Error('Invalid file format'), false);
};

@Controller('pcloud')
export class PcloudController {
  constructor(private readonly upload_Pcloud: upload_Pcloud) {}

  // 1. Upload nhiều file
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'hinhAnh', maxCount: 5 }], {
      storage: memoryStorage,
      fileFilter,
    }),
  )
  async uploadFiles(
    // @Body('username') username: string,
    @UploadedFiles() files: { hinhAnh?: Express.Multer.File[] },
    @Res() res: Response,
  ) {
    try {
      if (!files.hinhAnh || files.hinhAnh.length === 0) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: 'No file uploaded' });
      }

      const results = [];
      for (const file of files.hinhAnh) {
        const uploadResult = await this.upload_Pcloud.uploadImageBufferToPCloud(
          file.buffer,
          file.originalname,
        );
        results.push({
          // username,
          ...uploadResult,
        });
      }

      return res.json(results);
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: error.message || 'Internal Server Error' });
    }
  }

  // 2. Xoá file theo fileid
  @Delete(':fileid')
  async deleteFile(@Param('fileid') fileid: string, @Res() res: Response) {
    try {
      const result = await this.upload_Pcloud.deleteImage(Number(fileid));
      return res.json(result);
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: error.message || 'Internal Server Error' });
    }
  }

  // 3. Cập nhật ảnh (xoá cũ + upload mới)
  @Post('update/:fileid')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'hinhAnh', maxCount: 1 }], {
      storage: memoryStorage,
      fileFilter,
    }),
  )
  async updateFile(
    @Param('fileid') fileid: string,
    @UploadedFiles() files: { hinhAnh?: Express.Multer.File[] },
    @Res() res: Response,
  ) {
    try {
      if (!files.hinhAnh || files.hinhAnh.length === 0) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: 'No file uploaded' });
      }

      const file = files.hinhAnh[0];
      const result = await this.upload_Pcloud.updateImage(
        Number(fileid),
        file.buffer,
        file.originalname,
      );

      return res.json(result);
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: error.message || 'Internal Server Error' });
    }
  }


  @Get('all')
  async getAll(@Res() res: Response) {
    try {
      const images = await this.upload_Pcloud.getAllImages();
      return res.json(images);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: error.message || 'Internal Server Error',
      });
    }
  }
}


// import { Controller, Post, Body, Res, UploadedFiles, UseInterceptors, HttpStatus } from '@nestjs/common';
// import { FileFieldsInterceptor } from '@nestjs/platform-express';
// import * as multer from 'multer';
// import { Response } from 'express';
// import { upload_Pcloud } from 'src/upload_pcloud.service';

// const memoryStorage = multer.memoryStorage();

// const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
//   const allowedFormats = ['jpg', 'jpeg', 'png'];
//   const fileFormat = file.originalname.split('.').pop().toLowerCase();
//   if (allowedFormats.includes(fileFormat)) cb(null, true);
//   else cb(new Error('Invalid file format'), false);
// };

// @Controller('pcloud')
// export class PcloudController {
//   constructor(private readonly upload_Pcloud: upload_Pcloud) {}

//   @Post()
//   @UseInterceptors(FileFieldsInterceptor(
//     [{ name: 'hinhAnh', maxCount: 5 }],
//     { storage: memoryStorage, fileFilter }
//   ))
//   async uploadFiles(
//     @Body('username') username: string, // lấy username từ form-data
//     @UploadedFiles() files: { hinhAnh?: Express.Multer.File[] },
//     @Res() res: Response
//   ) {
//     try {
//       if (!files.hinhAnh || files.hinhAnh.length === 0) {
//         return res.status(HttpStatus.BAD_REQUEST).json({ message: 'No file uploaded' });
//       }

//       const results = [];
//       for (const file of files.hinhAnh) {
//         const uploadResult = await this.upload_Pcloud.uploadImageBufferToPCloud(
//           file.buffer,
//           file.originalname
//         );
//         results.push({
//           username, // thêm username vào mỗi file
//           ...uploadResult
//         });
//       }

//       return res.json(results);
//     } catch (error) {
//       return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
//         message: error.message || 'Internal Server Error',
//       });
//     }
//   }
// }



// import {
//   Controller,
//   Get,
//   HttpException,
//   HttpStatus,
//   Post,
//   Res,
//   UploadedFiles,
//   UseInterceptors
// } from '@nestjs/common';
// import { FileFieldsInterceptor } from '@nestjs/platform-express';
// import * as multer from 'multer';
// import { Response } from 'express';
// import { upload_Pcloud } from 'src/upload_pcloud.service';

// // Cấu hình multer lưu file trong bộ nhớ
// const memoryStorage = multer.memoryStorage();

// // Hàm kiểm tra định dạng file
// const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
//   const allowedFormats = ['jpg', 'jpeg', 'png'];
//   const fileFormat = file.originalname.split('.').pop().toLowerCase();

//   if (allowedFormats.includes(fileFormat)) {
//     cb(null, true);
//   } else {
//     cb(
//       new HttpException(
//         'Invalid file format: Only jpg, jpeg, and png are allowed.',
//         HttpStatus.BAD_REQUEST
//       ),
//       false
//     );
//   }
// };

// @Controller('pcloud')
// export class PcloudController {
//   constructor(private readonly upload_Pcloud: upload_Pcloud) {}

//   @Get()
//   getHello(): string {
//     return 'API Pcloud hoạt động!';
//   }

//   @Post()
//   @UseInterceptors(
//     FileFieldsInterceptor(
//       [
//         { name: 'hinhAnh', maxCount: 10 }, // cho phép tối đa 10 ảnh
//       ],
//       {
//         storage: memoryStorage,
//         fileFilter: fileFilter,
//       }
//     )
//   )
//   async uploadMultipleImages(
//     @UploadedFiles() files: { hinhAnh?: Express.Multer.File[] },
//     @Res() res: Response
//   ) {
//     try {
//       const avatarFiles = files.hinhAnh;

//       if (!avatarFiles || avatarFiles.length === 0) {
//         return res
//           .status(HttpStatus.BAD_REQUEST)
//           .json({ message: 'No file uploaded' });
//       }

//       // Upload song song để tiết kiệm thời gian
//       const results = await Promise.all(
//         avatarFiles.map(file =>
//           this.upload_Pcloud.uploadImageBufferToPCloud(
//             file.buffer,
//             file.originalname
//           )
//         )
//       );

//       return res.json({
//         message: 'Upload thành công',
//         files: results,
//       });
//     } catch (error) {
//       return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
//         statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
//         message: error.message || 'Internal Server Error',
//       });
//     }
//   }
// }

    // @Post()
    // @UseInterceptors(FileFieldsInterceptor(
    //     [
    //         { name: 'hinhAnh', maxCount: 1 },
    //         // thêm các field file khác nếu cần
    //     ],
    //     {
    //         storage: memoryStorage,
    //         fileFilter: fileFilter,
    //     }
    // ))
    // async createRoom(
    //     @UploadedFiles() files: { hinhAnh?: Express.Multer.File[] },
    //     @Res() res: Response
    // ) {
    //     try {
    //         const avatarFiles = files.hinhAnh;
    //         console.log(avatarFiles);
    //         // if (avatarFiles && avatarFiles.length > 0) {
    //         //     for (const file of avatarFiles) {
    //         //         const uploadResult = await this.upload_Pcloud.uploadImageBufferToPCloud(file.buffer, file.originalname);
    //         //         return res.json(uploadResult);

    //         //     }
    //         //     // const file = avatarFiles[0];
    //         //     // const uploadResult = await this.pCloudService.uploadImageBufferToPCloud(file.buffer, file.originalname);
    //         //     // return res.json(uploadResult);
    //         // } else {
    //         //     return res.status(HttpStatus.BAD_REQUEST).json({ message: 'No file uploaded' });
    //         // }
    //     } catch (error) {
    //         return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    //             statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    //             message: error.message || 'Internal Server Error',
    //         });
    //     }
    // }

// }
