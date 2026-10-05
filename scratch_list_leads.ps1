$loginBody = '{"email":"naveen@ghlindiaventures.com","password":"Password@123"}'
$loginRes = Invoke-RestMethod -Uri "http://localhost:5106/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$headers = @{ "Authorization" = "Bearer $($loginRes.data.token)" }
$leadsRes = Invoke-RestMethod -Uri "http://localhost:5106/api/sales-executive/leads?status=all" -Method Get -Headers $headers
foreach ($lead in $leadsRes.data.items) {
    Write-Output "ID=$($lead.id) | Name=$($lead.name) | AgentId=$($lead.assignedAgentId) | AgentName=$($lead.assignedAgentName) | Status=$($lead.status) | CompanyId=$($lead.companyId)"
}
 