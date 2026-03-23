import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  // Access token configuration (short-lived, sent in response body)
  const accessTokenSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessTokenSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET is required. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  // Refresh token configuration (long-lived, stored in httpOnly cookie)
  const refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshTokenSecret) {
    throw new Error(
      'JWT_REFRESH_SECRET is required. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  return {
    // Dual-token system per protect.md (lines 20-32)
    accessTokenSecret,
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
    refreshTokenSecret,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

    // Backward compatibility (deprecated)
    secret: accessTokenSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES_IN || '2h',
  };
});
