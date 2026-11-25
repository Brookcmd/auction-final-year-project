import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditRecordInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  referenceId?: string;
  metadata?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async record(input: AuditRecordInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: input.userId || null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          previousState:
            input.previousState !== undefined ? JSON.stringify(input.previousState) : null,
          newState: input.newState !== undefined ? JSON.stringify(input.newState) : null,
          reason: input.reason || null,
          referenceId: input.referenceId || null,
          metadata: input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
          ipAddress: input.ipAddress || null,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log write warning: ${(err as Error).message}`);
      return null;
    }
  }
}
