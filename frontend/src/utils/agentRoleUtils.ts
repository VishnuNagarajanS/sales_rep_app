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
  if (nameLower.includes('dhin') || idStr === '5' || nameLower.includes('created by irm') || (nameLower.includes('irm') && !nameLower.includes('sales'))) {
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

export interface AssignableEntity {
  assignedAgentName?: string | null;
  assignedAgentId?: string | number | null;
  assignedByName?: string | null;
  assignedById?: string | number | null;
  assignedIrmName?: string | null;
  assignedIrmId?: string | number | null;
  assignedIrmAt?: string | null;
  createdBy?: string | null;
  notes?: string | null;
  customFields?: Record<string, any> | null;
}

/**
 * When a lead or follow-up is viewed by IRM, this helper extracts
 * the Sales Person / Admin who assigned / handed over the lead to IRM.
 * Dhinakaran (IRM) is NEVER shown as the assigning sales agent.
 */
export function getAssigningSalesAgentInfo(
  lead?: AssignableEntity | null,
  followup?: AssignableEntity | null
): AgentRoleInfo {
  // 1. Explicit assignedByName if not IRM
  const leadAssignedByName =
    lead?.assignedByName && lead.assignedByName !== 'Created by IRM' && !lead.assignedByName.toLowerCase().includes('dhin')
      ? lead.assignedByName
      : null;
  const fuAssignedByName =
    followup?.assignedByName && followup.assignedByName !== 'Created by IRM' && !followup.assignedByName.toLowerCase().includes('dhin')
      ? followup.assignedByName
      : null;

  // 2. Custom fields attribution
  const cfQualifiedBy =
    lead?.customFields?.qualifiedByAgentName ||
    lead?.customFields?.assignedByAgentName ||
    lead?.customFields?.salesAgentName ||
    lead?.customFields?.agentName;

  // 3. Assigned agent name if it belongs to a sales agent (not Dhinakaran)
  const leadAgentName =
    lead?.assignedAgentName && !lead.assignedAgentName.toLowerCase().includes('dhin') && !lead.assignedAgentName.toLowerCase().includes('irm')
      ? lead.assignedAgentName
      : null;
  const fuAgentName =
    followup?.assignedAgentName && !followup.assignedAgentName.toLowerCase().includes('dhin') && !followup.assignedAgentName.toLowerCase().includes('irm')
      ? followup.assignedAgentName
      : null;

  // 4. Assigned IDs
  const assignorId = lead?.assignedById || followup?.assignedById;
  const leadAgentId = lead?.assignedAgentId && String(lead.assignedAgentId) !== '5' ? lead.assignedAgentId : null;

  // 5. Notes regex for handover attribution: "by Naveen" or "by Vishnu"
  let nameFromNotes: string | null = null;
  const combinedNotes = `${lead?.notes || ''} ${followup?.notes || ''}`;
  const matchBy = combinedNotes.match(/Assigned to IRM:[^b]*by\s+([A-Za-z0-9_-]+)/i);
  if (matchBy && matchBy[1]) {
    const rawMatch = matchBy[1].trim();
    if (!rawMatch.toLowerCase().includes('dhin') && !rawMatch.toLowerCase().includes('irm')) {
      nameFromNotes = rawMatch;
    }
  }

  // Check for Vishnu (GHL Admin / Company Admin)
  if (
    String(assignorId) === '2' ||
    String(leadAgentId) === '2' ||
    leadAssignedByName?.toLowerCase().includes('vishnu') ||
    fuAssignedByName?.toLowerCase().includes('vishnu') ||
    (cfQualifiedBy && String(cfQualifiedBy).toLowerCase().includes('vishnu')) ||
    leadAgentName?.toLowerCase().includes('vishnu') ||
    nameFromNotes?.toLowerCase().includes('vishnu')
  ) {
    return getAgentRoleInfo('Vishnu', '2');
  }

  // Explicit sales person found
  const explicitSalesName =
    leadAssignedByName ||
    fuAssignedByName ||
    (cfQualifiedBy && !String(cfQualifiedBy).toLowerCase().includes('dhin') ? String(cfQualifiedBy) : null) ||
    leadAgentName ||
    fuAgentName ||
    nameFromNotes;

  if (explicitSalesName && !explicitSalesName.toLowerCase().includes('dhin') && !explicitSalesName.toLowerCase().includes('irm')) {
    return getAgentRoleInfo(explicitSalesName, assignorId || leadAgentId);
  }

  // Check ID mappings
  if (String(assignorId) === '3' || String(leadAgentId) === '3') {
    return getAgentRoleInfo('Naveen', '3');
  }
  if (String(assignorId) === '6' || String(leadAgentId) === '6') {
    return getAgentRoleInfo('Rajesh Sharma', '6');
  }

  // Pure IRM lead: created directly by Dhinakaran with no sales person handover
  const isPureIrm =
    (lead?.assignedByName === 'Created by IRM' || lead?.createdBy?.toLowerCase().includes('dhin')) &&
    !lead?.assignedIrmAt &&
    !matchBy;

  if (isPureIrm) {
    return getAgentRoleInfo('Dhinakaran', '5', 'IRM');
  }

  // Default for IRM leads handed over by the sales team
  return getAgentRoleInfo('Naveen', '3');
}

