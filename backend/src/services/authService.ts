import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { generateToken } from '../utils/jwt';
import { badRequest, unauthorized } from '../utils/httpError';
import { DEFAULT_ROLE, legacyRoleFor, toPlatformRole, type PlatformRole } from '../utils/roles';
import { logger } from '../config/logger';
import { activityLogRepository } from '../repositories/activityLogRepository';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  phone?: string;
  skills?: string[];
  designation?: string;
  departmentId?: string;
  managerUserId?: string;
  timezone?: string;
  dailyCapacityMinutes?: number;
}

interface RegistrationActor {
  id: string;
  role: string;
  organizationId?: string;
}

const toAuthResponse = (user: { id: string; name: string; email: string; role: string; platform_role?: PlatformRole; designation?: string | null; department?: string | null; department_id?: string | null; photo?: string | null; onboarding_completed_at?: string | null }) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  platformRole: user.platform_role || toPlatformRole(user.role),
  designation: user.designation ?? null,
  department: user.department ?? null,
  departmentId: user.department_id ?? null,
  photo: user.photo ?? null,
  onboardingRequired: !user.onboarding_completed_at,
  token: generateToken({ id: user.id, role: user.role, platformRole: user.platform_role || toPlatformRole(user.role) }),
});

export const authService = {
  async register(input: RegisterInput, actor: RegistrationActor) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw badRequest('User already exists');
    }

    const platformRole = input.role ? toPlatformRole(input.role) : 'TEAM_MEMBER';
    const role = legacyRoleFor(platformRole, input.designation || input.role) || DEFAULT_ROLE;

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password_hash: passwordHash,
      role,
      platform_role: platformRole,
      organization_id: actor.organizationId,
      designation: input.designation || input.role || role,
      department: input.department,
      department_id: input.departmentId,
      manager_user_id: input.managerUserId,
      timezone: input.timezone,
      daily_capacity_minutes: input.dailyCapacityMinutes,
      account_status: 'INVITED',
      invited_at: new Date().toISOString(),
      phone: input.phone,
      skills: input.skills,
    });

    await activityLogRepository.create({
      action: 'User Invited',
      user_id: actor.id,
      details: `${user.name} was added to the organization.`,
      event: {
        eventType: 'USER_INVITED',
        entityType: 'USER',
        entityId: user.id,
        payload: { invitedUserId: user.id, platformRole },
      },
    });

    return toAuthResponse(user);
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    const passwordMatches = !!user?.password_hash && (await bcrypt.compare(password, user.password_hash));
    // Deliberately never logs the password itself - just enough to tell,
    // after the fact, whether a rejected login actually reached this code
    // (vs. failing in transit before the server ever saw the request) and
    // which check it failed.
    logger.info('Login attempt', { email, userFound: !!user, passwordMatches });
    if (!user || !passwordMatches) {
      throw unauthorized('Invalid email or password');
    }
    if (user.deleted_at) throw unauthorized('Invalid email or password');
    if (user.status === 'Inactive' || ['INACTIVE', 'SUSPENDED'].includes(user.account_status || '')) throw unauthorized('Account is inactive');
    await userRepository.update(user.id, { last_login_at: new Date().toISOString() });
    return toAuthResponse(user);
  },

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized('User not found');
    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      platformRole: user.platform_role || toPlatformRole(user.role),
      designation: user.designation,
      department: user.department,
      departmentId: user.department_id,
      onboardingRequired: !user.onboarding_completed_at,
    };
  },
};
