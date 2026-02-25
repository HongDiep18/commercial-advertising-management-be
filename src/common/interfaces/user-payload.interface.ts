import { Role } from '../enums/role.enum';

export interface UserPayload {
  userId: string;
  email: string;
  role: Role;
}
