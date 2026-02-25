import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserPayload } from '../interfaces/user-payload.interface';

type RequestWithUser = { user?: UserPayload };

export const CurrentUser = createParamDecorator<
  keyof UserPayload | undefined,
  UserPayload | UserPayload[keyof UserPayload] | undefined
>((data, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  const user = request.user;
  if (!user) return undefined;
  return data ? user[data] : user;
});
