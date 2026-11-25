import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma successfully connected to PostgreSQL database');
    } catch (err) {
      this.logger.warn(`Could not connect to PostgreSQL directly (${err.message}). System will operate with local memory adapter or retry.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
