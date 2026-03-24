import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but does not reject unauthenticated requests.
 * If a valid JWT is present, populates req.user. Otherwise, req.user is undefined.
 * Use on endpoints that support both authenticated and guest access.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(_err: unknown, user: T): T {
    return user;
  }
}
