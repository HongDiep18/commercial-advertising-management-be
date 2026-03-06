import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    bucketName: process.env.MINIO_BUCKET_NAME || 'vn-buyer-guide',
    publicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
    maxFiles: parseInt(process.env.MAX_FILES || '10', 10),
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
  },
}));
