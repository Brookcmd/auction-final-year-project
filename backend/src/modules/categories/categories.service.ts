import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: {
            auctions: {
              where: {
                status: { in: ['ACTIVE', 'EXTENDED'] },
              },
            },
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { auctions: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category ${slug} not found`);
    }
    return category;
  }
}
