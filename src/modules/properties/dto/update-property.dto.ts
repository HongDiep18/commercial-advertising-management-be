import { PartialType } from '@nestjs/swagger';
import { CreatePropertyDto } from './create-property.dto';

/**
 * Represents the payload used to update a property.
 */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
