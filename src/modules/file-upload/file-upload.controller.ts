import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileUploadErrors } from './file-upload.errors';
import { FileUploadService } from './file-upload.service';

@ApiTags('File Upload')
@ApiBearerAuth()
@Controller('files')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a single file',
    description:
      'Uploads a single image file to MinIO storage and returns the URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload (JPEG, PNG, WebP, GIF)',
        },
        folder: {
          type: 'string',
          description: 'Optional folder path to organize files',
          example: 'ads/2025/04',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'http://localhost:9000/vn-buyer-guide/ads/uuid.jpg',
        },
        filename: {
          type: 'string',
          example: 'uuid.jpg',
        },
        sizeKb: {
          type: 'number',
          example: 245,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        ...FileUploadErrors.NO_FILE,
      });
    }
    return this.fileUploadService.uploadFile(file, folder);
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({
    summary: 'Upload multiple files',
    description:
      'Uploads multiple image files to MinIO storage and returns URLs.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Image files to upload (max 10 files)',
        },
        folder: {
          type: 'string',
          description: 'Optional folder path to organize files',
          example: 'ads/2025/04',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              filename: { type: 'string' },
              sizeKb: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid files or too many files' })
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        ...FileUploadErrors.NO_FILES,
      });
    }
    const uploadedFiles = await this.fileUploadService.uploadFiles(
      files,
      folder,
    );
    return { files: uploadedFiles };
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete a file',
    description:
      'Deletes a file from MinIO storage by object name. Use the full object path as returned in the upload URL.',
  })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 400, description: 'Failed to delete file' })
  async deleteFile(@Query('objectName') objectName: string) {
    if (!objectName) {
      throw new BadRequestException({
        ...FileUploadErrors.OBJECT_NAME_REQUIRED,
      });
    }
    await this.fileUploadService.deleteFile(objectName);
    return { message: 'File deleted successfully', objectName };
  }
}
