import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT ?? '3000', 10),
  env: process.env.APP_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
}));
