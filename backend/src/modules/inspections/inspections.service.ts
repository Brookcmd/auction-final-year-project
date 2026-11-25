import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { AuctionStatus, ConditionGrade, InspectionCategoryType, NotificationType } from '@prisma/client';

const CATEGORY_CHECKLIST_TEMPLATES: Record<InspectionCategoryType, string[]> = {
  VEHICLES: [
    'Engine condition & idle smoothness',
    'Exterior body & paint condition',
    'Interior cabin & upholstery',
    'Odometer / mileage reading verification',
    'Tire tread depth & wheel alignment',
    'Accident or structural frame damage check',
    'Brakes, suspension & transmission test',
  ],
  ELECTRONICS: [
    'Power-on & boot verification',
    'Screen / display dead pixels & brightness',
    'Battery health & charging port test',
    'Physical casing damage / ports inspection',
    'Included accessories & chargers check',
    'Serial number & hardware spec verification',
  ],
  MACHINERY: [
    'Operational startup & load test',
    'Mechanical components & hydraulics',
    'Safety guards & emergency stop switches',
    'Wear, tear & corrosion inspection',
    'Maintenance log & hour-meter verification',
  ],
  REAL_ESTATE: [
    'Structural foundation & wall integrity',
    'Interior & exterior finishes',
    'Visible roof, plumbing, or damp damage',
    'Electrical & water utility connection check',
    'Ownership / title documentation status check',
  ],
  AGRICULTURAL_EQUIPMENT: [
    'Operational field readiness & engine test',
    'Mechanical PTO / hydraulic performance',
    'Blades, attachments & spare components',
    'Visible frame cracks or rust damage',
    'Maintenance history verification',
  ],
};

@Injectable()
export class InspectionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  getTemplate(categoryType: InspectionCategoryType) {
    return {
      categoryType,
      fields: CATEGORY_CHECKLIST_TEMPLATES[categoryType] || CATEGORY_CHECKLIST_TEMPLATES.VEHICLES,
      conditionGrades: Object.values(ConditionGrade),
    };
  }

  async registerPartner(userId: string, dto: any) {
    const partner = await this.prisma.inspectionPartner.upsert({
      where: { userId },
      update: {
        companyName: dto.companyName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        serviceLocations: dto.serviceLocations,
        supportedCategories: dto.supportedCategories,
        qualifications: dto.qualifications,
        businessRegNumber: dto.businessRegNumber || null,
        certificationsUrl: dto.certificationsUrl || null,
        yearsExperience: Number(dto.yearsExperience || 1),
        approvalStatus: 'PENDING',
      },
      create: {
        userId,
        companyName: dto.companyName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        serviceLocations: dto.serviceLocations,
        supportedCategories: dto.supportedCategories,
        qualifications: dto.qualifications,
        businessRegNumber: dto.businessRegNumber || null,
        certificationsUrl: dto.certificationsUrl || null,
        yearsExperience: Number(dto.yearsExperience || 1),
        approvalStatus: 'PENDING',
      },
    });

    await this.auditService.record({
      userId,
      action: 'INSPECTION_PARTNER_APPLIED',
      entityType: 'InspectionPartner',
      entityId: partner.id,
      newState: { companyName: partner.companyName, approvalStatus: 'PENDING' },
    });

    return partner;
  }

  async listPartners(approvalStatus?: string) {
    return this.prisma.inspectionPartner.findMany({
      where: approvalStatus ? { approvalStatus } : undefined,
      include: {
        user: { select: { id: true, email: true, status: true } },
        _count: { select: { assignments: true, reports: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewPartner(
    partnerId: string,
    adminId: string,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    reason?: string,
  ) {
    const existing = await this.prisma.inspectionPartner.findUnique({ where: { id: partnerId } });
    if (!existing) throw new NotFoundException('Inspection partner not found');

    const updated = await this.prisma.inspectionPartner.update({
      where: { id: partnerId },
      data: {
        approvalStatus: status,
        approvedById: status === 'APPROVED' ? adminId : existing.approvedById,
        approvedAt: status === 'APPROVED' ? new Date() : existing.approvedAt,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: existing.userId,
        title: `Inspection Partner Status: ${status}`,
        message: `Your inspection partner application for "${existing.companyName}" is now ${status}.${
          reason ? ` Notes: ${reason}` : ''
        }`,
        type: NotificationType.INSPECTION_UPDATE,
        linkUrl: '/dashboard/inspector',
      },
    });

    await this.auditService.record({
      userId: adminId,
      action: `INSPECTION_PARTNER_${status}`,
      entityType: 'InspectionPartner',
      entityId: partnerId,
      previousState: { approvalStatus: existing.approvalStatus },
      newState: { approvalStatus: status },
      reason: reason || `Partner ${status}`,
    });

    return updated;
  }

  async createInspectionRequest(
    auctionId: string,
    requesterId: string,
    dto: { categoryType: InspectionCategoryType; locationAddress: string; notes?: string },
  ) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');

    const req = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inspectionRequest.create({
        data: {
          auctionId,
          requestedById: requesterId,
          categoryType: dto.categoryType || InspectionCategoryType.VEHICLES,
          locationAddress: dto.locationAddress || auction.locationCity,
          notes: dto.notes || null,
          status: 'REQUESTED',
        },
      });

      await tx.auction.update({
        where: { id: auctionId },
        data: { requiresInspection: true, status: AuctionStatus.INSPECTION_REQUIRED },
      });

      return created;
    });

    await this.auditService.record({
      userId: requesterId,
      action: 'INSPECTION_REQUEST_CREATED',
      entityType: 'InspectionRequest',
      entityId: req.id,
      newState: { auctionId, categoryType: req.categoryType },
    });

    return req;
  }

  async listAllRequests() {
    return this.prisma.inspectionRequest.findMany({
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            status: true,
            locationCity: true,
            seller: { select: { email: true, profile: { select: { fullName: true, phoneNumber: true } } } },
          },
        },
        assignments: {
          include: { partner: { select: { id: true, companyName: true, contactName: true } } },
          orderBy: { assignedAt: 'desc' },
        },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignInspector(requestId: string, partnerId: string, managerId: string, feeETB = 2500) {
    const [request, partner] = await Promise.all([
      this.prisma.inspectionRequest.findUnique({
        where: { id: requestId },
        include: { auction: true },
      }),
      this.prisma.inspectionPartner.findUnique({ where: { id: partnerId } }),
    ]);

    if (!request) throw new NotFoundException('Inspection request not found');
    if (!partner) throw new NotFoundException('Inspection partner not found');
    if (partner.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('Only Super Admin approved inspection partners can receive assignments');
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inspectionAssignment.create({
        data: {
          requestId,
          partnerId,
          assignedById: managerId,
          feeETB,
          status: 'PENDING',
        },
      });

      await tx.inspectionRequest.update({
        where: { id: requestId },
        data: { status: 'ASSIGNED' },
      });

      await tx.auction.update({
        where: { id: request.auctionId },
        data: { status: AuctionStatus.INSPECTION_PENDING },
      });

      await tx.notification.create({
        data: {
          userId: partner.userId,
          title: 'New Inspection Assignment',
          message: `You have been assigned to inspect "${request.auction.title}" in ${request.locationAddress}.`,
          type: NotificationType.INSPECTION_UPDATE,
          linkUrl: '/dashboard/inspector',
        },
      });

      return created;
    });

    await this.auditService.record({
      userId: managerId,
      action: 'INSPECTOR_ASSIGNED',
      entityType: 'InspectionAssignment',
      entityId: assignment.id,
      newState: { requestId, partnerId, auctionId: request.auctionId },
    });

    return assignment;
  }

  async getPartnerDashboardData(userId: string) {
    const partner = await this.prisma.inspectionPartner.findUnique({
      where: { userId },
    });
    if (!partner) {
      return { registered: false, partner: null, assignments: [], reports: [] };
    }

    const [assignments, reports] = await Promise.all([
      this.prisma.inspectionAssignment.findMany({
        where: { partnerId: partner.id },
        include: {
          request: {
            include: {
              auction: {
                select: {
                  id: true,
                  title: true,
                  locationCity: true,
                  condition: true,
                  status: true,
                  images: { take: 1 },
                  seller: {
                    select: {
                      email: true,
                      profile: { select: { fullName: true, phoneNumber: true, city: true } },
                    },
                  },
                },
              },
              report: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.inspectionReport.findMany({
        where: { partnerId: partner.id },
        include: { auction: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { registered: true, partner, assignments, reports };
  }

  async respondToAssignment(
    assignmentId: string,
    partnerUserId: string,
    accept: boolean,
    scheduledAt?: string,
    rejectionReason?: string,
  ) {
    const assignment = await this.prisma.inspectionAssignment.findUnique({
      where: { id: assignmentId },
      include: { partner: true, request: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.partner.userId !== partnerUserId) {
      throw new ForbiddenException('Not authorized for this assignment');
    }

    const status = accept ? 'ACCEPTED' : 'REJECTED';
    const nextRequestStatus = accept ? (scheduledAt ? 'SCHEDULED' : 'ACCEPTED') : 'REQUESTED';

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.inspectionAssignment.update({
        where: { id: assignmentId },
        data: {
          status,
          rejectionReason: accept ? null : rejectionReason || 'Unavailable',
          respondedAt: new Date(),
        },
      });

      await tx.inspectionRequest.update({
        where: { id: assignment.requestId },
        data: {
          status: nextRequestStatus,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : assignment.request.scheduledAt,
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId: partnerUserId,
      action: `INSPECTION_ASSIGNMENT_${status}`,
      entityType: 'InspectionAssignment',
      entityId: assignmentId,
      reason: rejectionReason,
    });

    return updated;
  }

  async submitReport(
    requestId: string,
    partnerUserId: string,
    dto: {
      conditionGrade: ConditionGrade;
      checklist: Record<string, string>;
      observations: string;
      defectsAndLimitations?: string;
      inspectorRemarks?: string;
      evidenceUrls?: string[];
      inspectionLocation?: string;
    },
  ) {
    const partner = await this.prisma.inspectionPartner.findUnique({
      where: { userId: partnerUserId },
    });
    if (!partner || partner.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Only approved inspection partners can submit reports');
    }

    const request = await this.prisma.inspectionRequest.findUnique({
      where: { id: requestId },
      include: { auction: true },
    });
    if (!request) throw new NotFoundException('Inspection request not found');

    const reportCode = `INSP-${new Date().getFullYear()}-${Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase()}`;

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inspectionReport.create({
        data: {
          reportCode,
          requestId,
          auctionId: request.auctionId,
          partnerId: partner.id,
          categoryType: request.categoryType,
          conditionGrade: dto.conditionGrade,
          checklistJson: JSON.stringify(dto.checklist || {}),
          observations: dto.observations,
          defectsAndLimitations: dto.defectsAndLimitations || null,
          inspectorRemarks: dto.inspectorRemarks || null,
          evidenceUrlsJson: JSON.stringify(dto.evidenceUrls || []),
          inspectionLocation: dto.inspectionLocation || request.locationAddress,
          adminReviewStatus: 'PENDING',
        },
      });

      await tx.inspectionRequest.update({
        where: { id: requestId },
        data: { status: 'REPORT_SUBMITTED' },
      });

      await tx.inspectionAssignment.updateMany({
        where: { requestId, partnerId: partner.id },
        data: { status: 'COMPLETED' },
      });

      await tx.auction.update({
        where: { id: request.auctionId },
        data: { status: AuctionStatus.INSPECTION_COMPLETED },
      });

      await tx.notification.create({
        data: {
          userId: request.auction.sellerId,
          title: 'Inspection Report Submitted',
          message: `Inspection report ${reportCode} has been submitted for "${request.auction.title}" and is awaiting Auction Manager review.`,
          type: NotificationType.INSPECTION_UPDATE,
          linkUrl: '/dashboard/seller',
        },
      });

      return created;
    });

    await this.auditService.record({
      userId: partnerUserId,
      action: 'INSPECTION_REPORT_SUBMITTED',
      entityType: 'InspectionReport',
      entityId: report.id,
      newState: { reportCode, conditionGrade: dto.conditionGrade, auctionId: request.auctionId },
    });

    return report;
  }

  async reviewReport(
    reportId: string,
    managerId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
    reviewNotes?: string,
  ) {
    const existing = await this.prisma.inspectionReport.findUnique({
      where: { id: reportId },
      include: { auction: true },
    });
    if (!existing) throw new NotFoundException('Inspection report not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.inspectionReport.update({
        where: { id: reportId },
        data: {
          adminReviewStatus: decision,
          reviewedById: managerId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        },
      });

      await tx.inspectionRequest.update({
        where: { id: existing.requestId },
        data: { status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
      });

      await tx.notification.create({
        data: {
          userId: existing.auction.sellerId,
          title: `Inspection Report ${decision}`,
          message: `Inspection report ${existing.reportCode} for "${existing.auction.title}" was ${decision.toLowerCase()}.`,
          type: NotificationType.INSPECTION_UPDATE,
          linkUrl: `/auctions/${existing.auctionId}`,
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId: managerId,
      action: `INSPECTION_REPORT_${decision}`,
      entityType: 'InspectionReport',
      entityId: reportId,
      previousState: { adminReviewStatus: existing.adminReviewStatus },
      newState: { adminReviewStatus: decision },
      reason: reviewNotes || `Report ${decision}`,
    });

    return updated;
  }
}
