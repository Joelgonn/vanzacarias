// SSOT Premium — VZ-018
// Fonte canônica: profiles.account_type === 'premium' || has_meal_plan_access === true
// Nunca confiar em frontend. Sempre usar perfil server-side.

export type PremiumProfile = {
  account_type?: string | null;
  has_meal_plan_access?: boolean | null;
  role?: string | null;
};

export function isPremiumProfile(profile: PremiumProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.account_type === 'premium' || !!profile.has_meal_plan_access;
}

export function getPremiumLabel(isPremium: boolean): string {
  return isPremium ? 'Premium' : 'Gratuito';
}

// Para rateLimiter: resolve limite sem duplicar lógica
export function getDailyLimitForProfile(profile: PremiumProfile | null | undefined): number {
  if (profile?.role === 'admin' || profile?.role === 'nutricionista') return 9999;
  return isPremiumProfile(profile) ? 80 : 25;
}
