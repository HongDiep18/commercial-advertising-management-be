import { Global, Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
