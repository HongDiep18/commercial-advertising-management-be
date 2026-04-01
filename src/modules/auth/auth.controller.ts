import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThrottleAuth } from '../../common/decorators/throttle-auth.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';
import { FileUploadService } from '../file-upload/file-upload.service';
import { AuthService } from './auth.service';
import { CaptchaVerificationService } from './captcha-verification.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import {
  UpdateProfileDto,
  UPDATE_PROFILE_FORM_KEYS,
} from './dto/update-profile.dto';
import { UpdateProfileRequestStatusDto } from './dto/update-profile-request-status.dto';
import { UpdateUserActiveDto } from './dto/update-user-active.dto';
import { UpdateIndustriesDto } from './dto/update-industries.dto';

const UPDATE_PROFILE_MULTIPART_SCHEMA = {
  type: 'object',
  properties: {
    logo_url: {
      type: 'string',
      format: 'binary',
      description: 'Logo image file (optional)',
    },
    ...Object.fromEntries(
      UPDATE_PROFILE_FORM_KEYS.map((k) => [k, { type: 'string' }]),
    ),
  },
};

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly fileUploadService: FileUploadService,
    private readonly captchaVerificationService: CaptchaVerificationService,
  ) {}

  @Post('login')
  @Public()
  @ThrottleAuth()
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user info' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account not approved' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiBody({ type: LoginDto, description: 'Email and password credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );

    // Store refresh token in secure HTTP-only cookie (per protect.md lines 23-28)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
      // secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      path: '/api/proxy/auth', // Restrict to auth endpoints
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send access token in response body
    return { accessToken, user };
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Returns new access token' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request): Promise<{ accessToken: string }> {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @Public()
  @ApiOperation({ summary: 'Logout and clear refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    // Clear the refresh token cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      path: '/api/proxy/auth',
    });

    return { message: 'Logout successful' };
  }

  @Post('register')
  @Public()
  @ThrottleAuth()
  @ApiOperation({ summary: 'Submit company profile registration request' })
  @ApiResponse({
    status: 201,
    description: 'Company profile request submitted; pending admin approval',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered or pending request',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('captcha')
  @Public()
  @ThrottleAuth()
  @ApiOperation({
    summary: 'Generate local text captcha challenge',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns captchaId + captchaText for frontend canvas rendering and submit verification.',
  })
  getCaptchaChallenge(): {
    captchaId: string;
    captchaText: string;
    expiresInMs: number;
  } {
    return this.captchaVerificationService.createChallenge();
  }

  @Post('forgot-password')
  @Public()
  @ThrottleAuth()
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description:
      'If the email is registered, a reset link is sent (same message either way)',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('set-password')
  @Public()
  @ApiOperation({
    summary:
      'Set password using token (from approval or forgot-password email)',
  })
  @ApiResponse({ status: 200, description: 'Password set, user can sign in' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiBody({ type: SetPasswordDto })
  async setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPassword(dto.token, dto.password);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiResponse({ status: 200, description: 'Returns current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Patch('update-profile')
  @UseInterceptors(FileInterceptor('logo_url'))
  @ApiOperation({
    summary: 'Update my profile',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPDATE_PROFILE_MULTIPART_SCHEMA })
  @ApiResponse({
    status: 200,
    description: 'Profile updated, includes logo',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() logoFile: Express.Multer.File,
  ) {
    const dto = { ...updateProfileDto };
    if (logoFile) {
      const { url } = await this.fileUploadService.uploadFile(
        logoFile,
        'company-logos',
      );
      dto.upload_logo = url;
    }
    return this.authService.updateProfile(userId, dto);
  }

  @Patch('profile/industries')
  @ApiOperation({
    summary: 'Select industries (Gold tier only - one-time)',
    description:
      'Allows Gold tier members to select 3 additional industries. This is a one-time action.',
  })
  @ApiBody({ type: UpdateIndustriesDto })
  @ApiResponse({
    status: 200,
    description: 'Industries selected successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or already selected',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateIndustries(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateIndustriesDto,
  ) {
    return this.authService.updateIndustries(userId, dto.selectedIndustries);
  }

  @Patch('profile-requests/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Update company registration status (pending / approved / rejected)',
    description:
      ':id is the company UUID (same id as in GET all-profile-requests).',
  })
  @ApiResponse({
    status: 200,
    description: 'Company registration status updated',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  updateProfileRequestStatus(
    @Param('id') id: string,
    @Body() body: UpdateProfileRequestStatusDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.authService.updateProfileRequestStatus(id, body.status, userId);
  }

  @Get('all-profile-requests')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List companies by registration status (optional filter)',
    description:
      'Returns companies with status and user linkage when approved. Query status=PENDING|APPROVED|REJECTED.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Companies (registration workflow) with user fields when applicable',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllProfileRequests(
    @Query('status') status?: string,
  ): Promise<unknown> {
    return this.authService.getAllProfileRequests(status);
  }

  @Patch('users/:id/active')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Enable or disable a user account',
    description:
      'Set isActive to true (enable) or false (disable). :id is the userId (e.g. from getAllProfileRequests item.userId). Disabled users cannot log in.',
  })
  @ApiBody({ type: UpdateUserActiveDto })
  @ApiResponse({ status: 200, description: 'User active status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Super Admin only',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async setUserActive(
    @Param('id') id: string,
    @Body() dto: UpdateUserActiveDto,
    @CurrentUser('userId') adminUserId: string,
  ) {
    return this.authService.setUserActive(adminUserId, id, dto.isActive);
  }

  @Delete('users/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Soft-delete user',
    description:
      'Sets user isActive to false and deletedAt to now. Stronger than disable; use PATCH to enable (clears deletedAt).',
  })
  @ApiResponse({ status: 200, description: 'User soft-deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Super Admin only',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser('userId') adminUserId: string,
  ) {
    return this.authService.softDeleteUser(adminUserId, id);
  }
}
