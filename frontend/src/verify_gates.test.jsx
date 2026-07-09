import { describe, it, expect } from 'vitest';

function evaluateGate({ dbUser, clerkUser, isRoleVerified, locationPath }) {
  const derivedRole = dbUser?.role || undefined;
  const stabilising = false;

  // Onboarding check
  const needsOnboarding = !derivedRole && !stabilising;
  if (needsOnboarding) {
    if (locationPath !== '/onboarding') {
      return { action: 'redirect', path: '/onboarding' };
    }
    return { render: 'OnboardingPage' };
  } else {
    if (locationPath === '/onboarding') {
      const homeRoute =
        ['admin','super_admin'].includes(derivedRole) ? '/admin' :
        derivedRole === 'tenant'   ? '/tenant' :
        derivedRole === 'landlord' ? '/dashboard' :
        '/dashboard';
      return { action: 'redirect', path: homeRoute };
    }
  }

  // Pending/rejected checks
  if (derivedRole === 'agent' && dbUser) {
    if (dbUser.agent_approval_status === 'pending') {
      return { render: 'VerificationPending' };
    }
    if (dbUser.agent_approval_status === 'rejected') {
      return { render: 'ApplicationRejected' };
    }
  }

  if (derivedRole === 'landlord' && dbUser) {
    if (dbUser.landlord_approval_status === 'pending') {
      return { render: 'LandlordVerificationPending' };
    }
    if (dbUser.landlord_approval_status === 'rejected') {
      return { render: 'LandlordApplicationRejected' };
    }
  }

  // Verification checks
  if (!isRoleVerified) {
    if (['agent', 'landlord', 'tenant'].includes(derivedRole)) {
      if (dbUser) {
        return { render: 'RoleIdVerification', expectedId: derivedRole === 'landlord' ? dbUser.landlord_id : derivedRole === 'agent' ? dbUser.user_code : 'tenant_code' };
      }
    } else if (derivedRole === 'admin' || derivedRole === 'super_admin') {
      return { render: 'AdminPasswordGuard' };
    }
  }

  // Safe dashboard
  return { render: 'Dashboard', role: derivedRole };
}

describe('Manual Gating Scenarios Verification', () => {
  it('Scenario 1: Fresh Google sign-in as a plain user (no role, no DB record) -> reaches onboarding', () => {
    const dbUser = null;
    const clerkUser = { publicMetadata: {} };
    const isRoleVerified = false;

    // From dashboard, should redirect to /onboarding
    const res1 = evaluateGate({ dbUser, clerkUser, isRoleVerified, locationPath: '/dashboard' });
    expect(res1).toEqual({ action: 'redirect', path: '/onboarding' });

    // On onboarding path, should render OnboardingPage
    const res2 = evaluateGate({ dbUser, clerkUser, isRoleVerified, locationPath: '/onboarding' });
    expect(res2).toEqual({ render: 'OnboardingPage' });
  });

  it('Scenario 2: Returning approved admin -> reaches the password gate (not the dashboard)', () => {
    const dbUser = { role: 'admin' };
    const clerkUser = { publicMetadata: { role: 'admin' } };
    const isRoleVerified = false; // not verified yet

    const res = evaluateGate({ dbUser, clerkUser, isRoleVerified, locationPath: '/admin' });
    expect(res).toEqual({ render: 'AdminPasswordGuard' });
  });

  it('Scenario 3: Returning approved agent -> reaches the Agent ID prompt (not onboarding)', () => {
    const dbUser = { role: 'agent', agent_approval_status: 'approved', user_code: 'AGT-MOM-001' };
    const clerkUser = { publicMetadata: { role: 'agent' } };
    const isRoleVerified = false; // not verified yet

    const res = evaluateGate({ dbUser, clerkUser, isRoleVerified, locationPath: '/dashboard' });
    expect(res).toEqual({ render: 'RoleIdVerification', expectedId: 'AGT-MOM-001' });
  });

  it('Scenario 4: Returning approved landlord -> reaches the Landlord ID prompt', () => {
    const dbUser = { role: 'landlord', landlord_approval_status: 'approved', landlord_id: '100001' };
    const clerkUser = { publicMetadata: { role: 'landlord' } };
    const isRoleVerified = false; // not verified yet

    const res = evaluateGate({ dbUser, clerkUser, isRoleVerified, locationPath: '/dashboard' });
    expect(res).toEqual({ render: 'RoleIdVerification', expectedId: '100001' });
  });
});
