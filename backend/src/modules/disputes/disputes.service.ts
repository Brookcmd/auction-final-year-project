import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  DisputeCategory,
  DisputeStatus,
  NotificationType,
  Role,
  TransactionWorkflowStatus,
} from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async openDispute(
    userId: string,
    dto: {
      transactionId?: string;
      auctionId?: string;
      category: DisputeCategory;
      reason: string;
      description?: string;
      evidenceUrl?: string;
    },
  ) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A dispute reason is required');
    }

    const disputeCode = `DSP-${new Date().getFullYear()}-${Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase()}`;

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          disputeCode,
          transactionId: dto.transactionId || null,
          auctionId: dto.auctionId || null,
          openedById: userId,
          category: dto.category || DisputeCategory.OTHER,
          reason: dto.reason.trim(),
          description: dto.description || null,
          evidenceUrl: dto.evidenceUrl || null,
          status: DisputeStatus.OPEN,
        },
      });

      if (dto.evidenceUrl) {
        await tx.disputeEvidence.create({
          data: {
            disputeId: created.id,
            uploadedById: userId,
            fileUrl: dto.evidenceUrl,
            description: 'Initial dispute evidence',
          },
        });
      }

      if (dto.transactionId) {
        await tx.transaction.update({
          where: { id: dto.transactionId },
          data: {
            disputed: true,
            workflowStatus: TransactionWorkflowStatus.DISPUTED,
          },
        });
      }

      return created;
    });

    await this.auditService.record({
      userId,
      action: 'DISPUTE_OPENED',
      entityType: 'Dispute',
      entityId: dispute.id,
      newState: { disputeCode, category: dispute.category, status: DisputeStatus.OPEN },
      reason: dto.reason,
    });

    return dispute;
  }

  async getMyDisputes(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { openedById: userId },
          { transaction: { buyerId: userId } },
          { transaction: { sellerId: userId } },
        ],
      },
      include: {
        auction: { select: { id: true, title: true } },
        transaction: { select: { id: true, agreementNumber: true, finalAmount: true } },
        messages: {
          include: { sender: { select: { email: true, role: true, profile: { select: { fullName: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
        evidences: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllDisputesAdmin(status?: DisputeStatus) {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      include: {
        openedBy: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        assignedAdmin: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        auction: { select: { id: true, title: true } },
        transaction: { select: { id: true, agreementNumber: true, finalAmount: true } },
        messages: {
          include: { sender: { select: { email: true, role: true, profile: { select: { fullName: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
        evidences: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async assignDispute(disputeId: string, adminId: string, actorId: string) {
    const existing = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!existing) throw new NotFoundException('Dispute not found');

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        assignedAdminId: adminId || actorId,
        status: DisputeStatus.UNDER_REVIEW,
      },
    });

    await this.auditService.record({
      userId: actorId,
      action: 'DISPUTE_ASSIGNED',
      entityType: 'Dispute',
      entityId: disputeId,
      previousState: { status: existing.status },
      newState: { status: DisputeStatus.UNDER_REVIEW, assignedAdminId: adminId || actorId },
    });

    return updated;
  }

  async addMessage(disputeId: string, userId: string, message: string) {
    if (!message || !message.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    return this.prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId: userId,
        message: message.trim(),
      },
    });
  }

  async addEvidence(disputeId: string, userId: string, fileUrl: string, description?: string) {
    if (!fileUrl) throw new BadRequestException('Evidence URL is required');
    return this.prisma.disputeEvidence.create({
      data: {
        disputeId,
        uploadedById: userId,
        fileUrl,
        description: description || null,
      },
    });
  }

  async recordDecision(
    disputeId: string,
    adminId: string,
    dto: { status: DisputeStatus; decision: string; adminNotes?: string },
  ) {
    if (!dto.decision || !dto.decision.trim()) {
      throw new BadRequestException('A documented decision is required');
    }
    const existing = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { transaction: true },
    });
    if (!existing) throw new NotFoundException('Dispute not found');

    const isClosed =
      dto.status === DisputeStatus.RESOLVED ||
      dto.status === DisputeStatus.REJECTED ||
      dto.status === DisputeStatus.CLOSED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: dto.status,
          decision: dto.decision,
          adminNotes: dto.adminNotes || existing.adminNotes,
          assignedAdminId: existing.assignedAdminId || adminId,
          resolvedAt: isClosed ? new Date() : existing.resolvedAt,
        },
      });

      if (existing.openedById) {
        await tx.notification.create({
          data: {
            userId: existing.openedById,
            title: `Dispute ${existing.disputeCode} Updated: ${dto.status}`,
            message: `Support/Admin recorded a decision: ${dto.decision}`,
            type: NotificationType.DISPUTE_ALERT,
            linkUrl: '/dashboard/buyer',
          },
        });
      }

      return saved;
    });

    await this.auditService.record({
      userId: adminId,
      action: `DISPUTE_DECISION_${dto.status}`,
      entityType: 'Dispute',
      entityId: disputeId,
      previousState: { status: existing.status },
      newState: { status: dto.status, decision: dto.decision },
      reason: dto.decision,
    });

    return updated;
  }

  async submitAppeal(disputeId: string, userId: string, appealReason: string) {
    if (!appealReason || !appealReason.trim()) {
      throw new BadRequestException('An appeal justification is required');
    }
    const existing = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!existing) throw new NotFoundException('Dispute not found');

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.APPEALED,
        appealReason: appealReason.trim(),
        appealedAt: new Date(),
      },
    });

    await this.auditService.record({
      userId,
      action: 'DISPUTE_APPEALED',
      entityType: 'Dispute',
      entityId: disputeId,
      previousState: { status: existing.status },
      newState: { status: DisputeStatus.APPEALED },
      reason: appealReason,
    });

    return updated;
  }
}
