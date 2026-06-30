import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLE_PLATFORM_ADMIN } from '../roles';

// Platform admin only (Better Auth admin plugin). Runs after global AuthGuard.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user ?? request.session?.user;

    if (!user?.id) {
      throw new UnauthorizedException('Unauthorised operation. Please sign in first..');
    }

    if (user.role !== ROLE_PLATFORM_ADMIN) {
      throw new UnauthorizedException('Unauthorised operation. You are not authorised to access this resource.');
    }

    return true;
  }
}
