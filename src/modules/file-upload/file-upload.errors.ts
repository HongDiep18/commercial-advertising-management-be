export const FileUploadErrors = {
  MINIO_CONFIG_MISSING: {
    code: 'FILE_UPLOAD_MINIO_CONFIG_MISSING',
    message:
      'MinIO storage configuration is missing. Please configure storage.minio in your environment.',
  },
  CONFIG_MISSING: {
    code: 'FILE_UPLOAD_CONFIG_MISSING',
    message:
      'File upload configuration is missing. Please configure storage.upload in your environment.',
  },
  INVALID_TYPE: {
    code: 'FILE_UPLOAD_INVALID_TYPE',
    message:
      'File type is not allowed. Allowed types are defined by storage.upload.allowedMimeTypes.',
  },
  TOO_LARGE: {
    code: 'FILE_UPLOAD_TOO_LARGE',
    message:
      'File size exceeds the maximum allowed size defined by storage.upload.maxFileSize.',
  },
  UPLOAD_FAILED: {
    code: 'FILE_UPLOAD_FAILED',
    message: 'Failed to upload file to storage.',
  },
  TOO_MANY_FILES: {
    code: 'FILE_UPLOAD_TOO_MANY_FILES',
    message:
      'Too many files provided. The number of files exceeds storage.upload.maxFiles.',
  },
  DELETE_FAILED: {
    code: 'FILE_DELETE_FAILED',
    message: 'Failed to delete file from storage.',
  },
  NO_FILE: {
    code: 'FILE_UPLOAD_NO_FILE',
    message: 'No file provided',
  },
  NO_FILES: {
    code: 'FILE_UPLOAD_NO_FILES',
    message: 'No files provided',
  },
  OBJECT_NAME_REQUIRED: {
    code: 'FILE_DELETE_OBJECT_NAME_REQUIRED',
    message: 'objectName query parameter is required',
  },
} as const;

export type FileUploadErrorKey = keyof typeof FileUploadErrors;
