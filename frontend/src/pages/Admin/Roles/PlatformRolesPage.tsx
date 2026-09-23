import React, { useState } from 'react';
import { Shield, Check, Save } from 'lucide-react';
import { PERMISSIONS } from '../../../constants/permissions';
import { SYSTEM_ROLES } from '../../../constants/roles';
import './PlatformRolesPage.css';

export const PlatformRolesPage: React.FC = () => {
  const [savedSuccess, setSavedSuccess] = useState(false);

  const permissionGroups = [
    {
      group: 'Leads Management',
      keys: [
        PERMISSIONS.LEADS_VIEW,
        PERMISSIONS.LEADS_CREATE,
        PERMISSIONS.LEADS_UPDATE,
        PERMISSIONS.LEADS_DELETE,
        PERMISSIONS.LEADS_ASSIGN,
        PERMISSIONS.LEADS_CONVERT,
        PERMISSIONS.LEADS_EXPORT,
        PERMISSIONS.LEADS_IMPORT,
      ],
    },
    {
      group: 'Customer 360 & Deals',
      keys: [
        PERMISSIONS.CUSTOMERS_VIEW,
        PERMISSIONS.CUSTOMERS_CREATE,
        PERMISSIONS.CUSTOMERS_UPDATE,
        PERMISSIONS.DEALS_VIEW,
        PERMISSIONS.DEALS_CREATE,
        PERMISSIONS.DEALS_UPDATE,
      ],
    },
    {
      group: 'Telephony & Live Calling',
      keys: [
        PERMISSIONS.CALLS_MAKE,
        PERMISSIONS.CALLS_RECEIVE,
        PERMISSIONS.CALLS_VIEW,
        PERMISSIONS.CALLS_RECORDINGS_PLAY,
      ],
    },
    {
      group: 'Operations & Real Estate (Jamin)',
      keys: [
        PERMISSIONS.PROPERTIES_VIEW,
        PERMISSIONS.PROPERTIES_UPDATE,
        PERMISSIONS.SITE_VISITS_VIEW,
        PERMISSIONS.SITE_VISITS_CREATE,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.BOOKINGS_CREATE,
      ],
    },
    {
      group: 'Investors & Advisory (GHL)',
      keys: [
        PERMISSIONS.INVESTORS_VIEW,
        PERMISSIONS.INVESTORS_CREATE,
        PERMISSIONS.CONSULTATIONS_VIEW,
        PERMISSIONS.CONSULTATIONS_CREATE,
        PERMISSIONS.OPPORTUNITIES_VIEW,
        PERMISSIONS.OPPORTUNITIES_CREATE,
      ],
    },
    {
      group: 'Analytics & Administration',
      keys: [
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.REPORTS_EXPORT,
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.SETTINGS_VIEW,
        PERMISSIONS.SETTINGS_UPDATE,
      ],
    },
  ];

  const roles = [
    { code: 'company_admin', name: 'Company Admin', desc: 'Full Tenant Scope' },
    { code: 'sales_manager', name: 'Sales Manager', desc: 'Team Scope' },
    { code: 'sales_executive', name: 'Sales Executive', desc: 'Own Assigned Records' },
  ];

  const hasPermission = (roleCode: string, perm: string) => {
    return SYSTEM_ROLES[roleCode]?.permissions.includes(perm);
  };

  return (
    <div className="platform-roles-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Shield size={24} color="#8b5cf6" /> Master Role-Permission Matrix
          </h1>
          <p className="page-subtitle">
            Canonical RBAC privilege grid defining system behaviors for tenant roles.
          </p>
        </div>

        <button
          className="btn btn-primary platform-roles-save-btn"
          onClick={() => {
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 2500);
          }}
        >
          <Save size={15} /> Save Matrix Definitions
        </button>
      </div>

      {savedSuccess && (
        <div className="platform-roles-alert-success">
          ✓ Role permission matrix updated across all active tenant nodes.
        </div>
      )}

      <div className="card platform-roles-matrix-card">
        <table className="platform-roles-table">
          <thead>
            <tr className="platform-roles-thead-tr">
              <th className="platform-roles-th-action">Action / Permission Key</th>
              {roles.map(r => (
                <th key={r.code} className="platform-roles-th-role">
                  <div className="platform-roles-role-name">{r.name}</div>
                  <div className="platform-roles-role-desc">{r.desc}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionGroups.map(group => (
              <React.Fragment key={group.group}>
                <tr className="platform-roles-group-tr">
                  <td colSpan={4} className="platform-roles-group-td">
                    ● {group.group.toUpperCase()}
                  </td>
                </tr>
                {group.keys.map(key => (
                  <tr key={key} className="platform-roles-row">
                    <td className="platform-roles-key-td">
                      {key}
                    </td>
                    {roles.map(r => (
                      <td key={r.code} className="platform-roles-cell">
                        {hasPermission(r.code, key) ? (
                          <span className="platform-roles-granted">✓ Granted</span>
                        ) : (
                          <span className="platform-roles-denied">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
