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
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums';
import { FileUploadService } from '../modules/file-upload/file-upload.service';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import {
  UpdateProfileDto,
  UPDATE_PROFILE_FORM_KEYS,
} from './dto/update-profile.dto';
import { UpdateProfileRequestStatusDto } from './dto/update-profile-request-status.dto';

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
  ) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user info' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiBody({ type: LoginDto, description: 'Email and password credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Submit company profile registration request' })
  @ApiResponse({
    status: 201,
    description: 'Company profile request submitted; pending admin approval',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered or pending request',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description:
      'If the email is registered, a reset link is sent (same message either way)',
  })
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

  @Patch('profile-requests/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a profile request status' })
  @ApiResponse({ status: 200, description: 'Profile request updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Profile request not found' })
  updateProfileRequestStatus(
    @Param('id') id: string,
    @Body() body: UpdateProfileRequestStatusDto,
  ) {
    return this.authService.updateProfileRequestStatus(id, body.status);
  }

  @Get('all-profile-requests')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all profile requests (optional filter by status)',
  })
  @ApiResponse({ status: 200, description: 'Returns user profile requests' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllProfileRequests(
    @Query('status') status?: string,
  ): Promise<unknown> {
    return this.authService.getAllProfileRequests(status);
  }
}
