import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLE_USER } from '../roles';

// School teacher / staff (Better Auth role "user"). Runs after global AuthGuard.
@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user ?? request.session?.user;

    if (!user?.id) {
      throw new UnauthorizedException('Unauthorised operation. Please sign in first..');
    }

    if (user.role !== ROLE_USER) {
      throw new UnauthorizedException('Unauthorised operation. You are not authorised to access this resource.');
    }

    return true;
  }
}
