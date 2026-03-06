import { Module } from '@nestjs/common';
import { AdEffectsRegistryService } from './ad-effects-registry.service';

@Module({
  providers: [AdEffectsRegistryService],
  exports: [AdEffectsRegistryService],
})
export class AdEffectsModule {}
