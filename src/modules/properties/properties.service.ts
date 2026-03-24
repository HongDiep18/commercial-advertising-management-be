import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  PropertyAvailabilityStatus,
  PropertyPublicationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { CreatePropertyContactInquiryDto } from './dto/create-property-contact-inquiry.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AdminPropertyDetailResponseDto } from './dto/admin-property-detail-response.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { ListPropertiesResponseDto } from './dto/list-properties-response.dto';
import { PropertyContactInquiryResponseDto } from './dto/property-contact-inquiry-response.dto';
import { PropertyLegalDocumentResponseDto } from './dto/property-legal-document-response.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

const propertyLegalDocumentSelect = {
  id: true,
  propertyId: true,
  fileUrl: true,
  fileName: true,
  mimeType: true,
  fileSizeKb: true,
  createdAt: true,
} satisfies Prisma.PropertyLegalDocumentSelect;

const propertyContactInquirySelect = {
  id: true,
  createdAt: true,
  propertyId: true,
  name: true,
  email: true,
  message: true,
} satisfies Prisma.PropertyContactInquirySelect;

const propertySelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  price: true,
  type: true,
  province: true,
  provinceName: true,
  fullAddress: true,
  latitude: true,
  longitude: true,
  areaValue: true,
  areaUnit: true,
  description: true,
  images: true,
  features: true,
  publicationStatus: true,
  publishedAt: true,
  availabilityStatus: true,
  soldAt: true,
  views: true,
  legalDocuments: {
    orderBy: {
      createdAt: 'desc',
    },
    select: propertyLegalDocumentSelect,
  },
} satisfies Prisma.PropertySelect;

const propertyAdminDetailSelect = {
  ...propertySelect,
  contactInquiries: {
    orderBy: {
      createdAt: 'desc',
    },
    select: propertyContactInquirySelect,
  },
} satisfies Prisma.PropertySelect;

type PropertyRecord = Prisma.PropertyGetPayload<{
  select: typeof propertySelect;
}>;

type PropertyAdminDetailRecord = Prisma.PropertyGetPayload<{
  select: typeof propertyAdminDetailSelect;
}>;

/**
 * Provides CRUD and legal document operations for properties.
 */
@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Creates a new property.
   */
  async createProperty(dto: CreatePropertyDto): Promise<PropertyResponseDto> {
    const property = await this.prisma.property.create({
      data: this.buildCreateInput(dto),
      select: propertySelect,
    });
    return this.mapProperty(property);
  }

  /**
   * Lists published properties for public clients.
   */
  async listPublishedProperties(
    query: ListPropertiesQueryDto,
  ): Promise<ListPropertiesResponseDto> {
    return this.listProperties(query, false);
  }

  /**
   * Lists all properties for administrators.
   */
  async listAdminProperties(
    query: ListPropertiesQueryDto,
  ): Promise<ListPropertiesResponseDto> {
    return this.listProperties(query, true);
  }

  /**
   * Gets a published property by id.
   */
  async getPublishedPropertyById(id: string): Promise<PropertyResponseDto> {
    const existingProperty = await this.prisma.property.findFirst({
      where: {
        id,
        publicationStatus: PropertyPublicationStatus.PUBLISHED,
      },
      select: {
        id: true,
      },
    });
    if (!existingProperty) {
      throw new NotFoundException('Property not found');
    }
    const property = await this.prisma.property.update({
      where: {
        id,
      },
      data: {
        views: {
          increment: 1,
        },
      },
      select: propertySelect,
    });
    return this.mapProperty(property);
  }

  /**
   * Creates a contact inquiry for a published property.
   */
  async createContactInquiry(
    propertyId: string,
    dto: CreatePropertyContactInquiryDto,
  ): Promise<PropertyContactInquiryResponseDto> {
    const existingProperty = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        publicationStatus: PropertyPublicationStatus.PUBLISHED,
      },
      select: {
        id: true,
      },
    });
    if (!existingProperty) {
      throw new NotFoundException('Property not found');
    }
    const inquiry = await this.prisma.propertyContactInquiry.create({
      data: {
        propertyId,
        name: dto.name,
        email: dto.email,
        message: dto.message ?? null,
      },
      select: propertyContactInquirySelect,
    });
    return this.mapContactInquiry(inquiry);
  }

  /**
   * Gets any property by id for administrators.
   */
  async getAdminPropertyById(
    id: string,
  ): Promise<AdminPropertyDetailResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: propertyAdminDetailSelect,
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    return this.mapAdminProperty(property);
  }

  /**
   * Updates an existing property.
   */
  async updateProperty(
    id: string,
    dto: UpdatePropertyDto,
  ): Promise<PropertyResponseDto> {
    await this.ensurePropertyExists(id);
    const property = await this.prisma.property.update({
      where: { id },
      data: this.buildUpdateInput(dto),
      select: propertySelect,
    });
    return this.mapProperty(property);
  }

  /**
   * Deletes a property.
   */
  async deleteProperty(id: string): Promise<{ message: string }> {
    await this.ensurePropertyExists(id);
    await this.prisma.property.delete({
      where: { id },
    });
    return { message: 'Property deleted successfully' };
  }

  /**
   * Uploads and persists legal documents for a property.
   */
  async uploadLegalDocuments(
    propertyId: string,
    files: Express.Multer.File[],
  ): Promise<PropertyLegalDocumentResponseDto[]> {
    await this.ensurePropertyExists(propertyId);
    const uploadedFiles = await Promise.all(
      files.map((file) =>
        this.fileUploadService.uploadFile(file, 'properties/legal-documents'),
      ),
    );
    const createdDocuments = await this.prisma.$transaction(
      uploadedFiles.map((uploadedFile, index) =>
        this.prisma.propertyLegalDocument.create({
          data: {
            propertyId,
            fileUrl: uploadedFile.url,
            fileName: files[index].originalname,
            mimeType: files[index].mimetype,
            fileSizeKb: uploadedFile.sizeKb,
          },
          select: propertyLegalDocumentSelect,
        }),
      ),
    );
    return createdDocuments.map((document) => this.mapLegalDocument(document));
  }

  /**
   * Deletes a legal document from a property.
   */
  async deleteLegalDocument(
    propertyId: string,
    documentId: string,
  ): Promise<{ message: string }> {
    const document = await this.prisma.propertyLegalDocument.findFirst({
      where: {
        id: documentId,
        propertyId,
      },
      select: propertyLegalDocumentSelect,
    });
    if (!document) {
      throw new NotFoundException('Property legal document not found');
    }
    const objectName = this.extractObjectNameFromUrl(document.fileUrl);
    if (objectName) {
      await this.fileUploadService.deleteFile(objectName);
    }
    await this.prisma.propertyLegalDocument.delete({
      where: {
        id: documentId,
      },
    });
    return { message: 'Property legal document deleted successfully' };
  }

  private async listProperties(
    query: ListPropertiesQueryDto,
    isAdmin: boolean,
  ): Promise<ListPropertiesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query, isAdmin);
    const orderBy = this.buildOrderBy(query);
    const [total, properties] = await this.prisma.$transaction([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: propertySelect,
      }),
    ]);
    return {
      properties: properties.map((property) => this.mapProperty(property)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private buildCreateInput(dto: CreatePropertyDto): Prisma.PropertyCreateInput {
    const publicationStatus =
      dto.publicationStatus ?? PropertyPublicationStatus.DRAFT;
    const availabilityStatus =
      dto.availabilityStatus ?? PropertyAvailabilityStatus.AVAILABLE;
    return {
      title: dto.title,
      price: dto.price,
      type: dto.type,
      province: dto.province,
      provinceName: dto.provinceName,
      fullAddress: dto.fullAddress,
      latitude: dto.latitude,
      longitude: dto.longitude,
      areaValue: dto.areaValue,
      areaUnit: dto.areaUnit,
      description: dto.description,
      images: dto.images ?? [],
      features: dto.features ?? [],
      publicationStatus,
      publishedAt: this.resolvePublishedAt(publicationStatus, dto.publishedAt),
      availabilityStatus,
      soldAt: this.resolveSoldAt(availabilityStatus, dto.soldAt),
      views: dto.views ?? 0,
    };
  }

  private buildUpdateInput(dto: UpdatePropertyDto): Prisma.PropertyUpdateInput {
    const data: Prisma.PropertyUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.province !== undefined) data.province = dto.province;
    if (dto.provinceName !== undefined) data.provinceName = dto.provinceName;
    if (dto.fullAddress !== undefined) data.fullAddress = dto.fullAddress;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.areaValue !== undefined) data.areaValue = dto.areaValue;
    if (dto.areaUnit !== undefined) data.areaUnit = dto.areaUnit;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.images !== undefined) data.images = dto.images;
    if (dto.features !== undefined) data.features = dto.features;
    if (dto.publicationStatus !== undefined) {
      data.publicationStatus = dto.publicationStatus;
      data.publishedAt = this.resolvePublishedAt(
        dto.publicationStatus,
        dto.publishedAt,
      );
    } else if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt;
    }
    if (dto.availabilityStatus !== undefined) {
      data.availabilityStatus = dto.availabilityStatus;
      data.soldAt = this.resolveSoldAt(dto.availabilityStatus, dto.soldAt);
    } else if (dto.soldAt !== undefined) {
      data.soldAt = dto.soldAt;
    }
    if (dto.views !== undefined) data.views = dto.views;
    return data;
  }

  private buildWhere(
    query: ListPropertiesQueryDto,
    isAdmin: boolean,
  ): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {};
    if (!isAdmin) {
      where.publicationStatus = PropertyPublicationStatus.PUBLISHED;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { provinceName: { contains: query.search, mode: 'insensitive' } },
        { fullAddress: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.type) where.type = query.type;
    if (query.province) where.province = query.province;
    if (isAdmin && query.publicationStatus) {
      where.publicationStatus = query.publicationStatus;
    }
    if (query.availabilityStatus) {
      where.availabilityStatus = query.availabilityStatus;
    }
    return where;
  }

  private buildOrderBy(
    query: ListPropertiesQueryDto,
  ): Prisma.PropertyOrderByWithRelationInput {
    const sortOrder = query.sortOrder ?? 'desc';
    switch (query.sortBy) {
      case 'updatedAt':
        return { updatedAt: sortOrder };
      case 'publishedAt':
        return { publishedAt: sortOrder };
      case 'soldAt':
        return { soldAt: sortOrder };
      case 'title':
        return { title: sortOrder };
      case 'views':
        return { views: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  private resolvePublishedAt(
    status: PropertyPublicationStatus,
    publishedAt?: Date,
  ): Date | null {
    if (publishedAt !== undefined) return publishedAt;
    if (status === PropertyPublicationStatus.PUBLISHED) return new Date();
    return null;
  }

  private resolveSoldAt(
    status: PropertyAvailabilityStatus,
    soldAt?: Date,
  ): Date | null {
    if (soldAt !== undefined) return soldAt;
    if (status === PropertyAvailabilityStatus.SOLD) return new Date();
    return null;
  }

  private mapProperty(property: PropertyRecord): PropertyResponseDto {
    return {
      id: property.id,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      title: property.title,
      price: property.price,
      type: property.type,
      province: property.province,
      provinceName: property.provinceName,
      fullAddress: property.fullAddress,
      latitude: property.latitude ? Number(property.latitude) : null,
      longitude: property.longitude ? Number(property.longitude) : null,
      areaValue: Number(property.areaValue),
      areaUnit: property.areaUnit,
      description: property.description,
      images: property.images,
      features: property.features,
      publicationStatus: property.publicationStatus,
      publishedAt: property.publishedAt,
      availabilityStatus: property.availabilityStatus,
      soldAt: property.soldAt,
      views: property.views,
      legalDocuments: property.legalDocuments.map((document) =>
        this.mapLegalDocument(document),
      ),
    };
  }

  private mapAdminProperty(
    property: PropertyAdminDetailRecord,
  ): AdminPropertyDetailResponseDto {
    return {
      ...this.mapProperty(property),
      contactInquiries: property.contactInquiries.map((inquiry) =>
        this.mapContactInquiry(inquiry),
      ),
      contactInquiryCount: property.contactInquiries.length,
    };
  }

  private mapLegalDocument(
    document: Prisma.PropertyLegalDocumentGetPayload<{
      select: typeof propertyLegalDocumentSelect;
    }>,
  ): PropertyLegalDocumentResponseDto {
    return {
      id: document.id,
      propertyId: document.propertyId,
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSizeKb: document.fileSizeKb,
      createdAt: document.createdAt,
    };
  }

  private mapContactInquiry(
    inquiry: Prisma.PropertyContactInquiryGetPayload<{
      select: typeof propertyContactInquirySelect;
    }>,
  ): PropertyContactInquiryResponseDto {
    return {
      id: inquiry.id,
      createdAt: inquiry.createdAt,
      propertyId: inquiry.propertyId,
      name: inquiry.name,
      email: inquiry.email,
      message: inquiry.message,
    };
  }

  private async ensurePropertyExists(id: string): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
  }

  private extractObjectNameFromUrl(fileUrl: string): string | null {
    try {
      const url = new URL(fileUrl);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length < 2) return null;
      return pathSegments.slice(1).join('/');
    } catch {
      return null;
    }
  }
}
