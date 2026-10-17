import os, re
root = 'c:/sales_rep_app/backend/Services/Ai/Tools'
for fn in os.listdir(root):
    if not fn.endswith('.cs'): continue
    p = os.path.join(root, fn)
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    orig = c

    if 'var db = services.GetRequiredService<ApplicationDbContext>();' in c:
        settings_code = '''var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();'''
        c = c.replace('var db = services.GetRequiredService<ApplicationDbContext>();', settings_code)
    
    c = c.replace('.Take(25)', '.Take(limit)')

    c = re.sub(r'l\.Email,', 'Email = includeContact ? l.Email : "[REDACTED]",', c)
    c = re.sub(r'l\.Phone,', 'Phone = includeContact ? l.Phone : "[REDACTED]",', c)
    
    c = re.sub(r'c\.Email,', 'Email = includeContact ? c.Email : "[REDACTED]",', c)
    c = re.sub(r'c\.Phone,', 'Phone = includeContact ? c.Phone : "[REDACTED]",', c)
    
    c = re.sub(r'i\.Email,', 'Email = includeContact ? i.Email : "[REDACTED]",', c)
    c = re.sub(r'i\.Phone,', 'Phone = includeContact ? i.Phone : "[REDACTED]",', c)
    
    c = re.sub(r'u\.Email,', 'Email = includeContact ? u.Email : "[REDACTED]",', c)
    c = re.sub(r'u\.Phone,', 'Phone = includeContact ? u.Phone : "[REDACTED]",', c)

    if c != orig:
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f'Updated {fn}')
