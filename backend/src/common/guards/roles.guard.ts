import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN holds highest platform authority across all administrative permissions
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Legacy ADMIN alias also satisfies SUPER_ADMIN-or-ADMIN routes for backward compatibility
    if (
      user.role === Role.ADMIN &&
      (requiredRoles.includes(Role.ADMIN) ||
        requiredRoles.includes(Role.SUPER_ADMIN) ||
        requiredRoles.includes(Role.AUCTION_MANAGER) ||
        requiredRoles.includes(Role.VERIFICATION_OFFICER) ||
        requiredRoles.includes(Role.FINANCE_OFFICER) ||
        requiredRoles.includes(Role.SUPPORT_OFFICER))
    ) {
      return true;
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(`Access restricted to roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
