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
