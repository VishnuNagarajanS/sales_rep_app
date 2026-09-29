using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddGhlTablesAndAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── GhlDeals ──────────────────────────────────────────────────────────
            // Stores GHL India Ventures pipeline deals (Sales Exec Kanban + IRM pipeline).
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""GhlDeals"" (
                    ""Id""                   SERIAL PRIMARY KEY,
                    ""CompanyId""            INTEGER NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                    ""AssignedAgentId""      INTEGER NOT NULL REFERENCES users(""Id"") ON DELETE RESTRICT,
                    ""CustomerId""           INTEGER NOT NULL,
                    ""Title""                VARCHAR(200) NOT NULL DEFAULT '',
                    ""CustomerName""         VARCHAR(150) NOT NULL DEFAULT '',
                    ""Stage""                VARCHAR(100) NOT NULL DEFAULT 'new',
                    ""Value""                NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""ExpectedCloseDate""    VARCHAR(100) NOT NULL DEFAULT '',
                    ""Notes""                TEXT NOT NULL DEFAULT '',
                    ""LostReason""           TEXT,
                    ""InvestorType""         VARCHAR(50),
                    ""InvestmentRange""      VARCHAR(100),
                    ""PreferredAssetClass""  VARCHAR(100),
                    ""Priority""             VARCHAR(50) NOT NULL DEFAULT 'Medium',
                    ""StageEnteredAt""       TIMESTAMPTZ,
                    ""CreatedAt""            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""UpdatedAt""            TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS ""IX_GhlDeals_CompanyId""       ON ""GhlDeals"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlDeals_AssignedAgentId""  ON ""GhlDeals"" (""AssignedAgentId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlDeals_Stage""            ON ""GhlDeals"" (""Stage"");
            ");

            // ── GhlDealActivities ────────────────────────────────────────────────
            // Activity log for each GHL deal: notes, calls, WhatsApp, meetings, stage changes.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""GhlDealActivities"" (
                    ""Id""            SERIAL PRIMARY KEY,
                    ""DealId""        INTEGER NOT NULL REFERENCES ""GhlDeals""(""Id"") ON DELETE CASCADE,
                    ""CompanyId""     INTEGER NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                    ""Type""          VARCHAR(50) NOT NULL DEFAULT 'note',
                    ""Text""          TEXT NOT NULL DEFAULT '',
                    ""FromStage""     VARCHAR(100),
                    ""ToStage""       VARCHAR(100),
                    ""LoggedByName""  VARCHAR(150) NOT NULL DEFAULT '',
                    ""LoggedByRole""  VARCHAR(100) NOT NULL DEFAULT '',
                    ""Timestamp""     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""CreatedAt""     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ""IX_GhlDealActivities_DealId""     ON ""GhlDealActivities"" (""DealId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlDealActivities_CompanyId""   ON ""GhlDealActivities"" (""CompanyId"");
            ");

            // ── GhlInvestors ─────────────────────────────────────────────────────
            // HNW investor profiles managed by GHL India Ventures (IRM + Sales Exec).
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""GhlInvestors"" (
                    ""Id""                   SERIAL PRIMARY KEY,
                    ""CompanyId""            INTEGER NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                    ""AssignedAgentId""      INTEGER NOT NULL REFERENCES users(""Id"") ON DELETE RESTRICT,
                    ""Name""                 VARCHAR(150) NOT NULL DEFAULT '',
                    ""Phone""                VARCHAR(50) NOT NULL DEFAULT '',
                    ""Email""                VARCHAR(255) NOT NULL DEFAULT '',
                    ""Status""               VARCHAR(50) NOT NULL DEFAULT 'Lead',
                    ""InvestmentCapacity""   VARCHAR(100) NOT NULL DEFAULT '',
                    ""PreferredAssetClass""  VARCHAR(100) NOT NULL DEFAULT '',
                    ""ReferralSource""       VARCHAR(150),
                    ""CommittedAUM""         VARCHAR(100),
                    ""InvestmentMandate""    TEXT,
                    ""RiskTolerance""        VARCHAR(50),
                    ""Notes""                TEXT NOT NULL DEFAULT '',
                    ""CreatedAt""            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""UpdatedAt""            TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_CompanyId""       ON ""GhlInvestors"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_AssignedAgentId""  ON ""GhlInvestors"" (""AssignedAgentId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_Status""           ON ""GhlInvestors"" (""Status"");
            ");

            // ── GhlInvestmentOpportunities ───────────────────────────────────────
            // AIF / CO-AIF investment opportunity pipeline per investor.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""GhlInvestmentOpportunities"" (
                    ""Id""                   SERIAL PRIMARY KEY,
                    ""CompanyId""            INTEGER NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                    ""InvestorId""           INTEGER NOT NULL REFERENCES ""GhlInvestors""(""Id"") ON DELETE CASCADE,
                    ""AssignedAgentId""      INTEGER NOT NULL REFERENCES users(""Id"") ON DELETE RESTRICT,
                    ""Title""                VARCHAR(200) NOT NULL DEFAULT '',
                    ""Stage""                VARCHAR(100) NOT NULL DEFAULT 'Enquiry',
                    ""TargetAmount""         NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""CommittedAmount""      NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""ExpectedCloseDate""    VARCHAR(100) NOT NULL DEFAULT '',
                    ""Notes""                TEXT NOT NULL DEFAULT '',
                    ""CreatedAt""            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""UpdatedAt""            TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS ""IX_GhlInvestmentOpportunities_CompanyId""   ON ""GhlInvestmentOpportunities"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlInvestmentOpportunities_InvestorId""  ON ""GhlInvestmentOpportunities"" (""InvestorId"");
                CREATE INDEX IF NOT EXISTS ""IX_GhlInvestmentOpportunities_Stage""       ON ""GhlInvestmentOpportunities"" (""Stage"");
            ");

            // ── AuditLogs ────────────────────────────────────────────────────────
            // Immutable audit trail of create/update/delete/login actions across all tenants.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""AuditLogs"" (
                    ""Id""          SERIAL PRIMARY KEY,
                    ""CompanyId""   INTEGER REFERENCES tenants(""Id"") ON DELETE SET NULL,
                    ""Timestamp""   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""ActorName""   VARCHAR(150) NOT NULL DEFAULT '',
                    ""ActorEmail""  VARCHAR(255) NOT NULL DEFAULT '',
                    ""Action""      VARCHAR(100) NOT NULL DEFAULT '',
                    ""EntityType""  VARCHAR(100) NOT NULL DEFAULT '',
                    ""EntityId""    VARCHAR(100) NOT NULL DEFAULT '',
                    ""Details""     TEXT NOT NULL DEFAULT '',
                    ""IpAddress""   VARCHAR(50),
                    ""UserAgent""   TEXT,
                    ""Module""      VARCHAR(100),
                    ""Status""      VARCHAR(20) NOT NULL DEFAULT 'success'
                );
                CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_CompanyId""   ON ""AuditLogs"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_Timestamp""   ON ""AuditLogs"" (""Timestamp"" DESC);
                CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_EntityType""  ON ""AuditLogs"" (""EntityType"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""AuditLogs"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""GhlInvestmentOpportunities"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""GhlInvestors"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""GhlDealActivities"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""GhlDeals"";");
        }
    }
}
