using ClosedXML.Excel;
using backend.Data;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.IO;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace backend.Services.Implementations;

public class ReportService : IReportService
{
    private readonly ApplicationDbContext _db;

    public ReportService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<byte[]> GenerateExportReportAsync(int companyId, string? module, CancellationToken ct = default)
    {
        using var workbook = new XLWorkbook();
        
        // Leads
        if (string.IsNullOrEmpty(module) || module.Equals("Leads", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Leads");
            var leads = await _db.Leads.Where(l => l.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Name";
            ws.Cell(1, 3).Value = "Email";
            ws.Cell(1, 4).Value = "Phone";
            ws.Cell(1, 5).Value = "Status";
            ws.Cell(1, 6).Value = "Assigned Agent ID";
            ws.Cell(1, 7).Value = "Created At";
            
            for (int i = 0; i < leads.Count; i++)
            {
                var r = i + 2;
                var l = leads[i];
                ws.Cell(r, 1).Value = l.Id;
                ws.Cell(r, 2).Value = l.Name;
                ws.Cell(r, 3).Value = l.Email;
                ws.Cell(r, 4).Value = l.Phone;
                ws.Cell(r, 5).Value = l.Status;
                ws.Cell(r, 6).Value = l.AssignedAgentId;
                ws.Cell(r, 7).Value = l.CreatedAt.ToString("yyyy-MM-dd HH:mm");
            }
            ws.Columns().AdjustToContents();
        }

        // Deals
        if (string.IsNullOrEmpty(module) || module.Equals("Deals", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Deals");
            var deals = await _db.GhlDeals.Where(d => d.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Title";
            ws.Cell(1, 3).Value = "Customer Name";
            ws.Cell(1, 4).Value = "Stage";
            ws.Cell(1, 5).Value = "Value";
            ws.Cell(1, 6).Value = "Assigned Agent ID";
            ws.Cell(1, 7).Value = "Expected Close";
            
            for (int i = 0; i < deals.Count; i++)
            {
                var r = i + 2;
                var d = deals[i];
                ws.Cell(r, 1).Value = d.Id;
                ws.Cell(r, 2).Value = d.Title;
                ws.Cell(r, 3).Value = d.CustomerName;
                ws.Cell(r, 4).Value = d.Stage;
                ws.Cell(r, 5).Value = d.Value;
                ws.Cell(r, 6).Value = d.AssignedAgentId;
                ws.Cell(r, 7).Value = d.ExpectedCloseDate;
            }
            ws.Columns().AdjustToContents();
        }

        // Leave Requests
        if (string.IsNullOrEmpty(module) || module.Equals("LeaveRequests", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Leave Requests");
            var leaves = await _db.LeaveRequests.Include(lr => lr.User).Where(l => l.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "User Name";
            ws.Cell(1, 3).Value = "Type";
            ws.Cell(1, 4).Value = "Start Date";
            ws.Cell(1, 5).Value = "End Date";
            ws.Cell(1, 6).Value = "Days";
            ws.Cell(1, 7).Value = "Status";
            
            for (int i = 0; i < leaves.Count; i++)
            {
                var r = i + 2;
                var l = leaves[i];
                ws.Cell(r, 1).Value = l.Id;
                ws.Cell(r, 2).Value = l.User?.Name;
                ws.Cell(r, 3).Value = l.LeaveType;
                ws.Cell(r, 4).Value = l.StartDate.ToString("yyyy-MM-dd");
                ws.Cell(r, 5).Value = l.EndDate.ToString("yyyy-MM-dd");
                ws.Cell(r, 6).Value = l.Days;
                ws.Cell(r, 7).Value = l.Status;
            }
            ws.Columns().AdjustToContents();
        }
        
        // Consultations
        if (string.IsNullOrEmpty(module) || module.Equals("Consultations", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Consultations");
            var consultations = await _db.Consultations.Where(c => c.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Investor Name";
            ws.Cell(1, 3).Value = "Consultant Name";
            ws.Cell(1, 4).Value = "Status";
            ws.Cell(1, 5).Value = "Scheduled At";
            ws.Cell(1, 6).Value = "Agenda";
            
            for (int i = 0; i < consultations.Count; i++)
            {
                var r = i + 2;
                var c = consultations[i];
                ws.Cell(r, 1).Value = c.Id;
                ws.Cell(r, 2).Value = c.InvestorName;
                ws.Cell(r, 3).Value = c.ConsultantName;
                ws.Cell(r, 4).Value = c.Status.ToString();
                ws.Cell(r, 5).Value = c.ScheduledAt.ToString("yyyy-MM-dd HH:mm");
                ws.Cell(r, 6).Value = c.Agenda;
            }
            ws.Columns().AdjustToContents();
        }
        // Customers
        if (string.IsNullOrEmpty(module) || module.Equals("Customers", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Customers");
            var customers = await _db.Customers.Where(c => c.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Name";
            ws.Cell(1, 3).Value = "Email";
            ws.Cell(1, 4).Value = "Phone";
            ws.Cell(1, 5).Value = "Status";
            ws.Cell(1, 6).Value = "Created At";
            
            for (int i = 0; i < customers.Count; i++)
            {
                var r = i + 2;
                var c = customers[i];
                ws.Cell(r, 1).Value = c.Id;
                ws.Cell(r, 2).Value = c.Name;
                ws.Cell(r, 3).Value = c.Email;
                ws.Cell(r, 4).Value = c.Phone;
                ws.Cell(r, 5).Value = c.Status;
                ws.Cell(r, 6).Value = c.CreatedAt.ToString("yyyy-MM-dd HH:mm");
            }
            ws.Columns().AdjustToContents();
        }

        // Users
        if (string.IsNullOrEmpty(module) || module.Equals("Users", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Users");
            var usersList = await _db.Users.Where(u => u.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Name";
            ws.Cell(1, 3).Value = "Email";
            ws.Cell(1, 4).Value = "Phone";
            ws.Cell(1, 5).Value = "Role";
            ws.Cell(1, 6).Value = "Status";
            
            for (int i = 0; i < usersList.Count; i++)
            {
                var r = i + 2;
                var u = usersList[i];
                ws.Cell(r, 1).Value = u.Id;
                ws.Cell(r, 2).Value = u.Name;
                ws.Cell(r, 3).Value = u.Email;
                ws.Cell(r, 4).Value = u.Phone;
                ws.Cell(r, 5).Value = u.RoleId;
                ws.Cell(r, 6).Value = u.Status.ToString();
            }
            ws.Columns().AdjustToContents();
        }

        // Work Handovers
        if (string.IsNullOrEmpty(module) || module.Equals("WorkHandovers", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Work Handovers");
            var handovers = await _db.WorkHandovers.Where(w => w.CompanyId == companyId).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Original User ID";
            ws.Cell(1, 3).Value = "Covering User ID";
            ws.Cell(1, 4).Value = "Status";
            ws.Cell(1, 5).Value = "Started At";
            ws.Cell(1, 6).Value = "Planned End";
            
            for (int i = 0; i < handovers.Count; i++)
            {
                var r = i + 2;
                var h = handovers[i];
                ws.Cell(r, 1).Value = h.Id;
                ws.Cell(r, 2).Value = h.OriginalUserId;
                ws.Cell(r, 3).Value = h.CoveringUserId;
                ws.Cell(r, 4).Value = h.Status;
                ws.Cell(r, 5).Value = h.StartedAt.ToString("yyyy-MM-dd HH:mm");
                ws.Cell(r, 6).Value = h.PlannedEndAt?.ToString("yyyy-MM-dd HH:mm") ?? "";
            }
            ws.Columns().AdjustToContents();
        }

        // Audit Logs
        if (string.IsNullOrEmpty(module) || module.Equals("AuditLogs", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Audit Logs");
            var logs = await _db.AuditLogs.Where(a => a.CompanyId == companyId).OrderByDescending(a => a.Timestamp).Take(1000).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "User ID";
            ws.Cell(1, 3).Value = "Action";
            ws.Cell(1, 4).Value = "Entity Type";
            ws.Cell(1, 5).Value = "Entity ID";
            ws.Cell(1, 6).Value = "Timestamp";
            
            for (int i = 0; i < logs.Count; i++)
            {
                var r = i + 2;
                var l = logs[i];
                ws.Cell(r, 1).Value = l.Id;
                ws.Cell(r, 2).Value = l.ActorName;
                ws.Cell(r, 3).Value = l.Action;
                ws.Cell(r, 4).Value = l.EntityType;
                ws.Cell(r, 5).Value = l.EntityId;
                ws.Cell(r, 6).Value = l.Timestamp.ToString("yyyy-MM-dd HH:mm");
            }
            ws.Columns().AdjustToContents();
        }

        // Call History
        if (string.IsNullOrEmpty(module) || module.Equals("CallHistory", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Call History");
            var calls = await _db.CallRecords.Where(c => c.CompanyId == companyId).OrderByDescending(c => c.Timestamp).Take(1000).ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Agent ID";
            ws.Cell(1, 3).Value = "Direction";
            ws.Cell(1, 4).Value = "Status";
            ws.Cell(1, 5).Value = "Duration (sec)";
            ws.Cell(1, 6).Value = "Timestamp";
            
            for (int i = 0; i < calls.Count; i++)
            {
                var r = i + 2;
                var c = calls[i];
                ws.Cell(r, 1).Value = c.Id;
                ws.Cell(r, 2).Value = c.AgentId;
                ws.Cell(r, 3).Value = c.Direction;
                ws.Cell(r, 4).Value = c.Disposition;
                ws.Cell(r, 5).Value = c.DurationSeconds;
                ws.Cell(r, 6).Value = c.StartedAt.ToString("yyyy-MM-dd HH:mm");
            }
            ws.Columns().AdjustToContents();
        }

        // Investors
        if (string.IsNullOrEmpty(module) || module.Equals("Investors", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Investors");
            var investors = await _db.GhlInvestors
                .Where(i => i.CompanyId == companyId)
                .Select(i => new { i.Id, i.Name, i.Email, i.Phone, i.InvestmentCapacity, i.AssignedAgentId })
                .ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Name";
            ws.Cell(1, 3).Value = "Email";
            ws.Cell(1, 4).Value = "Phone";
            ws.Cell(1, 5).Value = "Tier";
            ws.Cell(1, 6).Value = "RM ID";
            
            for (int i = 0; i < investors.Count; i++)
            {
                var r = i + 2;
                var inv = investors[i];
                ws.Cell(r, 1).Value = inv.Id;
                ws.Cell(r, 2).Value = inv.Name;
                ws.Cell(r, 3).Value = inv.Email;
                ws.Cell(r, 4).Value = inv.Phone;
                ws.Cell(r, 5).Value = inv.InvestmentCapacity;
                ws.Cell(r, 6).Value = inv.AssignedAgentId;
            }
            ws.Columns().AdjustToContents();
        }

        // Opportunities
        if (string.IsNullOrEmpty(module) || module.Equals("Opportunities", StringComparison.OrdinalIgnoreCase) || module.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var ws = workbook.Worksheets.Add("Opportunities");
            var opps = await _db.GhlInvestmentOpportunities
                .Where(o => o.CompanyId == companyId)
                .Select(o => new { o.Id, o.Title, o.InvestorId, o.TargetAmount, o.Stage, o.AssignedAgentId })
                .ToListAsync(ct);
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Title";
            ws.Cell(1, 3).Value = "Investor ID";
            ws.Cell(1, 4).Value = "Target Amount";
            ws.Cell(1, 5).Value = "Stage";
            ws.Cell(1, 6).Value = "RM ID";
            
            for (int i = 0; i < opps.Count; i++)
            {
                var r = i + 2;
                var o = opps[i];
                ws.Cell(r, 1).Value = o.Id;
                ws.Cell(r, 2).Value = o.Title;
                ws.Cell(r, 3).Value = o.InvestorId;
                ws.Cell(r, 4).Value = o.TargetAmount;
                ws.Cell(r, 5).Value = o.Stage;
                ws.Cell(r, 6).Value = o.AssignedAgentId;
            }
            ws.Columns().AdjustToContents();
        }

        if (workbook.Worksheets.Count == 0)
        {
            var ws = workbook.Worksheets.Add("Empty");
            ws.Cell(1, 1).Value = "No data found for the selected module.";
        }

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }
}
