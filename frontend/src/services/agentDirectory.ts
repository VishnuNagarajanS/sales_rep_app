import { Lead } from '../types';
import { apiClient } from './apiClient';
import { adminUserService } from './adminUserService';
import { storageService } from './storageService';

/**
 * An agent an admin can assign leads to.
 *  - id    : string used by the UI (real DB user id, or "mock-<n>" fallback)
 *  - dbId  : numeric DB user id. Only set for REAL users; if missing, the
 *            assignment is kept locally only (we never send fake ids to the DB).
 */
export interface AssignableAgent {
  id: string;
  name: string;
  dbId?: number;
  roleCode?: string;
}

export interface AgentDirectory {
  agents: AssignableAgent[];
  /** user ids that belong to admins/managers (a lead "owned" by them is still UNASSIGNED) */
  adminIds: Set<string>;
  fromApi: boolean;
}

const NON_AGENT_ROLE = /admin|manager|irm|relationship/i;

/** Loads real sales-executive users from the backend (fallback: mock agents). */
export async function loadAgentDirectory(companyId?: string, currentUserId?: string): Promise<AgentDirectory> {
  const adminIds = new Set<string>();
  if (currentUserId) adminIds.add(String(currentUserId));

  if (!apiClient.isMockMode()) {
    try {
      const res = await apiClient.get<any>('/ghl/agents');
      if (res.success && res.data) {
        const agents: AssignableAgent[] = res.data.map((u: any) => ({
          id: String(u.userId || u.id),
          name: u.name,
          dbId: Number(u.userId || u.id),
          roleCode: u.roleCode
        }));
        return { agents, adminIds, fromApi: true };
      }
    } catch (err) {
      console.warn('[agentDirectory] Could not load agents from API:', err);
    }

    try {
      const realAgents = storageService.getAgents(companyId).map((a: any) => ({
        id: String(a.id),
        name: a.name,
        dbId: isNaN(Number(a.id)) ? undefined : Number(a.id),
      }));
      if (realAgents.length > 0) {
        return { agents: realAgents, adminIds, fromApi: true };
      }
    } catch {}

    return { agents: [], adminIds, fromApi: true };
  }

  // Fallback (offline / mock mode)
  const mock = storageService.getMockAgents().map((a: { id: number | string; name: string }) => ({
    id: `mock-${a.id}`,
    name: a.name,
  }));
  return { agents: mock, adminIds, fromApi: false };
}

/**
 * A lead is "assigned" only when it belongs to a sales agent.
 * Leads that are empty, or still owned by the admin who created them, are UNASSIGNED.
 */
export function isLeadAssigned(lead: Lead, adminIds: Set<string>): boolean {
  const agentId = lead.assignedAgentId != null ? String(lead.assignedAgentId).trim() : '';
  if (!agentId || agentId === '0') return false;
  return !adminIds.has(agentId);
}

/** Saves the assignment to the backend (real agents only) and mirrors it locally. */
export async function persistLeadAssignment(lead: Lead, agent: AssignableAgent): Promise<Lead> {
  const leadId = String(lead.id);
  if (agent.dbId && leadId.startsWith('db-')) {
    await apiClient.put(`/sales-executive/leads/${leadId.replace('db-', '')}`, {
      assignedAgentId: agent.dbId,
    });
  }
  const updated: Lead = {
    ...lead,
    assignedAgentId: agent.id,
    assignedAgentName: agent.name,
    assignmentStatus: 'assigned',
    assignedAt: new Date().toISOString(),
  };
  storageService.saveLead(updated); // also fires 'nexus_storage_updated' -> pages refresh
  return updated;
}
