import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';
import { userRepository } from '../repositories/userRepository';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { SUPER_ADMIN_ROLE } from '../utils/roles';

// Registration is public/self-service (anyone who registers becomes a Team
// Member automatically - see authService.register), so there's no admin
// action that creates the very first account. This runs once at boot to
// guarantee a Super Admin exists, using the ADMIN_EMAIL/ADMIN_PASSWORD env
// vars reserved for exactly this in .env.example.
export const ensureSuperAdminSeeded = async (): Promise<void> => {
  const { data: existingSuperAdmin, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', SUPER_ADMIN_ROLE)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existingSuperAdmin) return;

  if (!env.adminEmail || !env.adminPassword) {
    logger.warn(
      'No Super Admin account exists yet and ADMIN_EMAIL/ADMIN_PASSWORD are not set - set them and restart to bootstrap one.'
    );
    return;
  }

  const existingUser = await userRepository.findByEmail(env.adminEmail);
  if (existingUser) {
    await userRepository.update(existingUser.id, { role: SUPER_ADMIN_ROLE, status: 'Active' });
    logger.info(`Promoted existing user ${env.adminEmail} to Super Admin.`);
    return;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  await userRepository.create({
    name: 'Super Admin',
    email: env.adminEmail,
    password_hash: passwordHash,
    role: SUPER_ADMIN_ROLE,
  });
  logger.info(`Seeded Super Admin account for ${env.adminEmail}.`);
};
