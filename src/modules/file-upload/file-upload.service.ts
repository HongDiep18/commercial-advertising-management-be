import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadErrors } from './file-upload.errors';

type MinioConfig = {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  publicUrl: string;
};

type UploadConfig = {
  maxFileSize: number;
  maxFiles: number;
  allowedMimeTypes: string[];
};

export interface UploadedFile {
  readonly fieldname: string;
  readonly originalname: string;
  readonly encoding: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

@Injectable()
export class FileUploadService {
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const storageConfig = this.configService.get<MinioConfig>('storage.minio');
    if (!storageConfig) {
      throw new InternalServerErrorException({
        ...FileUploadErrors.MINIO_CONFIG_MISSING,
      });
    }
    this.bucketName = storageConfig.bucketName;
    this.publicUrl = storageConfig.publicUrl;

    this.minioClient = new Minio.Client({
      endPoint: storageConfig.endpoint,
      port: storageConfig.port,
      useSSL: storageConfig.useSSL,
      accessKey: storageConfig.accessKey,
      secretKey: storageConfig.secretKey,
    });

    void this.ensureBucketExists();
  }

  /**
   * Ensure the bucket exists, create if it doesn't.
   */
  private async ensureBucketExists(): Promise<void> {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
    }
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucketName}/*`],
        },
      ],
    };
    await this.minioClient.setBucketPolicy(
      this.bucketName,
      JSON.stringify(policy),
    );
  }

  /**
   * Upload a file to MinIO storage.
   */
  async uploadFile(
    file: UploadedFile,
    folder?: string,
  ): Promise<{ url: string; filename: string; sizeKb: number }> {
    const uploadConfig = this.configService.get<UploadConfig>('storage.upload');
    if (!uploadConfig) {
      throw new InternalServerErrorException({
        ...FileUploadErrors.CONFIG_MISSING,
      });
    }
    const allowedTypes = uploadConfig.allowedMimeTypes;

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        ...FileUploadErrors.INVALID_TYPE,
      });
    }

    if (file.size > uploadConfig.maxFileSize) {
      throw new BadRequestException({
        ...FileUploadErrors.TOO_LARGE,
      });
    }

    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const objectName = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

    try {
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
        },
      );

      const fileUrl = `${this.publicUrl}/${this.bucketName}/${objectName}`;
      const sizeKb = Math.ceil(file.size / 1024);

      return {
        url: fileUrl,
        filename: uniqueFilename,
        sizeKb,
      };
    } catch (error) {
      throw new BadRequestException({
        ...FileUploadErrors.UPLOAD_FAILED,
      });
    }
  }

  /**
   * Upload multiple files to MinIO storage.
   */
  async uploadFiles(
    files: UploadedFile[],
    folder?: string,
  ): Promise<Array<{ url: string; filename: string; sizeKb: number }>> {
    const uploadConfig = this.configService.get<UploadConfig>('storage.upload');
    if (!uploadConfig) {
      throw new InternalServerErrorException({
        ...FileUploadErrors.CONFIG_MISSING,
      });
    }

    if (files.length > uploadConfig.maxFiles) {
      throw new BadRequestException({
        ...FileUploadErrors.TOO_MANY_FILES,
      });
    }

    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Delete a file from MinIO storage.
   */
  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
    } catch (error) {
      throw new BadRequestException({
        ...FileUploadErrors.DELETE_FAILED,
      });
    }
  }

  /**
   * Get file URL from object name.
   */
  getFileUrl(objectName: string): string {
    return `${this.publicUrl}/${this.bucketName}/${objectName}`;
  }
}
