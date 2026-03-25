import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FileUploadErrors } from '../file-upload/file-upload.errors';
import { CreatePropertyContactInquiryDto } from './dto/create-property-contact-inquiry.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AdminPropertyDetailResponseDto } from './dto/admin-property-detail-response.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { ListPropertiesResponseDto } from './dto/list-properties-response.dto';
import { PropertyContactInquiryResponseDto } from './dto/property-contact-inquiry-response.dto';
import { PropertyLegalDocumentResponseDto } from './dto/property-legal-document-response.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

/**
 * Exposes property CRUD and legal document endpoints.
 */
@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  /**
   * Lists all properties for administrators.
   */
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all properties for administrators' })
  @ApiResponse({ status: 200, type: ListPropertiesResponseDto })
  async listAdminProperties(
    @Query() query: ListPropertiesQueryDto,
  ): Promise<ListPropertiesResponseDto> {
    return this.propertiesService.listAdminProperties(query);
  }

  /**
   * Gets a property by id for administrators.
   */
  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a property by id for administrators' })
  @ApiResponse({ status: 200, type: AdminPropertyDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getAdminPropertyById(
    @Param('id') id: string,
  ): Promise<AdminPropertyDetailResponseDto> {
    return this.propertiesService.getAdminPropertyById(id);
  }

  /**
   * Creates a property.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a property' })
  @ApiResponse({ status: 201, type: PropertyResponseDto })
  async createProperty(
    @Body() dto: CreatePropertyDto,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<PropertyResponseDto> {
    return this.propertiesService.createProperty(dto, adminUserId);
  }

  /**
   * Updates a property.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a property' })
  @ApiResponse({ status: 200, type: PropertyResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async updateProperty(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<PropertyResponseDto> {
    return this.propertiesService.updateProperty(id, dto, adminUserId);
  }

  /**
   * Deletes a property.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a property' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Property deleted successfully' },
      },
    },
  })
  async deleteProperty(
    @Param('id') id: string,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<{ message: string }> {
    return this.propertiesService.deleteProperty(id, adminUserId);
  }

  /**
   * Uploads legal documents for a property.
   */
  @Post(':id/legal-documents')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload legal documents for a property' })
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
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: PropertyLegalDocumentResponseDto,
    isArray: true,
  })
  async uploadLegalDocuments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('userId') adminUserId: string,
  ): Promise<PropertyLegalDocumentResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException({ ...FileUploadErrors.NO_FILES });
    }
    return this.propertiesService.uploadLegalDocuments(id, files, adminUserId);
  }

  /**
   * Deletes a legal document from a property.
   */
  @Delete(':propertyId/legal-documents/:documentId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a legal document from a property' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Property legal document deleted successfully',
        },
      },
    },
  })
  async deleteLegalDocument(
    @Param('propertyId') propertyId: string,
    @Param('documentId') documentId: string,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<{ message: string }> {
    return this.propertiesService.deleteLegalDocument(
      propertyId,
      documentId,
      adminUserId,
    );
  }

  /**
   * Lists published properties for public clients.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List published properties' })
  @ApiResponse({ status: 200, type: ListPropertiesResponseDto })
  async listPublishedProperties(
    @Query() query: ListPropertiesQueryDto,
  ): Promise<ListPropertiesResponseDto> {
    return this.propertiesService.listPublishedProperties(query);
  }

  /**
   * Gets a published property by id.
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a published property by id' })
  @ApiResponse({ status: 200, type: PropertyResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getPublishedPropertyById(
    @Param('id') id: string,
  ): Promise<PropertyResponseDto> {
    return this.propertiesService.getPublishedPropertyById(id);
  }

  /**
   * Creates a public contact inquiry for a published property.
   */
  @Post(':id/contact-inquiries')
  @Public()
  @ApiOperation({
    summary: 'Create a contact inquiry for a published property',
  })
  @ApiResponse({ status: 201, type: PropertyContactInquiryResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async createContactInquiry(
    @Param('id') id: string,
    @Body() dto: CreatePropertyContactInquiryDto,
  ): Promise<PropertyContactInquiryResponseDto> {
    return this.propertiesService.createContactInquiry(id, dto);
  }
}
