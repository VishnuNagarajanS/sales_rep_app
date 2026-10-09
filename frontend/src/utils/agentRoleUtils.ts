export interface AgentRoleInfo {
  name: string;
  role: 'GHL Admin' | 'Sales Executive' | 'IRM' | 'Platform Admin' | 'Company Admin';
  badgeClass: 'badge-role-admin' | 'badge-role-sales' | 'badge-role-irm';
  iconColor: string;
}

/**
 * Returns accurate agent name, role title, and CSS badge class.
 * - Vishnu -> GHL Admin (badge-role-admin)
 * - Naveen / Rajesh Sharma -> Sales Executive (badge-role-sales)
 * - Dhinakaran -> IRM (badge-role-irm)
 * - Yanosh -> Platform Admin (badge-role-admin)
 * - Mani -> Company Admin (badge-role-admin)
 */
export function getAgentRoleInfo(
  agentName?: string | null,
  agentId?: string | number | null,
  fallbackRole?: string | null
): AgentRoleInfo {
  const name = (agentName || '').trim();
  const nameLower = name.toLowerCase();
  const idStr = String(agentId || '');

  // 1. Vishnu -> GHL Admin
  if (nameLower.includes('vishnu') || idStr === '2') {
    return {
      name: name || 'Vishnu',
      role: 'GHL Admin',
      badgeClass: 'badge-role-admin',
      iconColor: '#ef4444',
    };
  }

  // 2. Yanosh -> Platform Admin
  if (nameLower.includes('yanosh') || idStr === '1') {
    return {
      name: name || 'Yanosh',
      role: 'Platform Admin',
      badgeClass: 'badge-role-admin',
      iconColor: '#ef4444',
    };
  }

  // 3. Mani -> Company Admin
  if (nameLower.includes('mani') || idStr === '4') {
    return {
      name: name || 'Mani',
      role: 'Company Admin',
      badgeClass: 'badge-role-admin',
      iconColor: '#ef4444',
    };
  }

  // 4. Naveen or Rajesh Sharma -> Sales Executive
  if (nameLower.includes('naveen') || idStr === '3' || nameLower.includes('rajesh') || idStr === '6') {
    return {
      name: name || (idStr === '6' ? 'Rajesh Sharma' : 'Naveen'),
      role: 'Sales Executive',
      badgeClass: 'badge-role-sales',
      iconColor: '#3b82f6',
    };
  }

  // 5. Dhinakaran -> IRM
  if (nameLower.includes('dhina') || idStr === '5' || nameLower.includes('created by irm')) {
    return {
      name: nameLower.includes('created by irm') ? 'Dhinakaran' : (name || 'Dhinakaran'),
      role: 'IRM',
      badgeClass: 'badge-role-irm',
      iconColor: '#8b5cf6',
    };
  }

  // 6. Explicit fallback role check
  if (fallbackRole) {
    const fbLower = fallbackRole.toLowerCase();
    if (fbLower.includes('admin')) {
      return {
        name: name || 'Admin',
        role: 'GHL Admin',
        badgeClass: 'badge-role-admin',
        iconColor: '#ef4444',
      };
    }
    if (fbLower === 'irm') {
      return {
        name: name || 'Dhinakaran',
        role: 'IRM',
        badgeClass: 'badge-role-irm',
        iconColor: '#8b5cf6',
      };
    }
    if (fbLower.includes('sales')) {
      return {
        name: name || 'Naveen',
        role: 'Sales Executive',
        badgeClass: 'badge-role-sales',
        iconColor: '#3b82f6',
      };
    }
  }

  // Default fallback to Sales Executive
  return {
    name: name || 'Naveen',
    role: 'Sales Executive',
    badgeClass: 'badge-role-sales',
    iconColor: '#3b82f6',
  };
}
