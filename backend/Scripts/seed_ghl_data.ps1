$ErrorActionPreference = "Stop"

# Log in as GHL Company Admin (Vikram Malhotra)
$login = Invoke-RestMethod -Uri "http://localhost:5106/api/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"vikram@ghlindiatrust.com","password":"Password@123"}'
$token = $login.data.token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Logged in successfully as Vikram Malhotra. Token acquired."

# 1. Seed Investors
$investors = @(
    @{
        name = "Venkatraman Narayanan"
        phone = "+91 98450 99887"
        email = "v.narayanan@apexholdings.sg"
        status = "Active Investor"
        investmentCapacity = "5 Cr - 10 Cr"
        preferredAssetClass = "Commercial Grade-A / Pre-Leased"
        referralSource = "Global Indian Wealth Network"
        committedAUM = "8 Cr"
        notes = "Focus on Bengaluru Outer Ring Road and Whitefield commercial IT assets."
    },
    @{
        name = "Dr. Rajesh Nambiar"
        phone = "+91 98451 12233"
        email = "dr.nambiar@cardiohealth.in"
        status = "Lead"
        investmentCapacity = "3 Cr - 5 Cr"
        preferredAssetClass = "Pre-Leased Commercial & Warehousing"
        referralSource = "HNW Doctors Syndicate"
        committedAUM = "4 Cr"
        notes = "Evaluating 9-year pre-leased banking branch floor in Koramangala."
    },
    @{
        name = "Siddharth Singhania"
        phone = "+91 98200 44556"
        email = "siddharth@singhaniafamilyoffice.com"
        status = "HNW Investor"
        investmentCapacity = "10 Cr - 25 Cr"
        preferredAssetClass = "Grade-A IT Parks & Logistics"
        referralSource = "Family Office Conclave"
        committedAUM = "15 Cr"
        notes = "Looking for core yielding commercial assets with minimum 8.5% cap rate."
    },
    @{
        name = "Meera Chidambaram"
        phone = "+91 98401 77665"
        email = "meera.c@chennaicapital.com"
        status = "Active Investor"
        investmentCapacity = "5 Cr - 10 Cr"
        preferredAssetClass = "Pre-Leased Commercial & Warehousing"
        referralSource = "Direct Inbound"
        committedAUM = "6.5 Cr"
        notes = "Interested in Bengaluru-Chennai corridor logistics & tech parks."
    },
    @{
        name = "Aditya Birla Singhal"
        phone = "+91 98199 33221"
        email = "aditya.singhal@singhalholdings.in"
        status = "Active Investor"
        investmentCapacity = "15 Cr - 30 Cr"
        preferredAssetClass = "Data Centers & Industrial REITs"
        referralSource = "Private Wealth Advisory"
        committedAUM = "12 Cr"
        notes = "Evaluating multi-tenant data center park in Whitefield."
    },
    @{
        name = "Sunita Kashyap"
        phone = "+91 98300 88776"
        email = "sunita.kashyap@kashyappharma.com"
        status = "Lead"
        investmentCapacity = "2 Cr - 5 Cr"
        preferredAssetClass = "Commercial Grade-A"
        referralSource = "Executive Referral"
        committedAUM = "3.5 Cr"
        notes = "First-time fractional commercial investor exploring pre-leased retail."
    }
)

$createdInvestors = @{}

foreach ($inv in $investors) {
    try {
        $body = $inv | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "http://localhost:5106/api/ghl/investors" -Method Post -Headers $headers -Body $body
        Write-Host "Created Investor: $($res.data.name) (Id: $($res.data.id))"
        $createdInvestors[$inv.name] = $res.data.id
    } catch {
        Write-Host "Failed to create investor $($inv.name): $_"
    }
}

# 2. Seed Deals
$deals = @(
    @{
        title = "Pre-Leased IT Park Suite (Floor 4)"
        customerName = "Venkatraman Narayanan"
        stage = "investment_opportunity"
        value = 45000000
        expectedCloseDate = "2026-03-25"
        priority = "High"
        preferredAssetClass = "Commercial Pre-Leased"
        investmentRange = "4.5 Cr"
        notes = "Term sheet shared. Waiting for legal review on tenant lock-in clause (9 years)."
    },
    @{
        title = "Commercial Logistics Fractional Tranche B"
        customerName = "Dr. Rajesh Nambiar"
        stage = "qualified_investor"
        value = 35000000
        expectedCloseDate = "2026-04-10"
        priority = "High"
        preferredAssetClass = "Commercial Logistics"
        investmentRange = "3.5 Cr - 5 Cr"
        notes = "KYC verified. Advisory deck presented. Follow up consultation scheduled."
    },
    @{
        title = "Grade-A Commercial Pre-Leased Suite"
        customerName = "Siddharth Singhania"
        stage = "leads"
        value = 150000000
        expectedCloseDate = "2026-04-30"
        priority = "High"
        preferredAssetClass = "Commercial Pre-Leased"
        investmentRange = "15 Cr - 25 Cr"
        notes = "Qualified handover from sales. Interested in pre-leased IT spaces with >8.5% yield."
    },
    @{
        title = "Fintech Hub Fractional Unit A"
        customerName = "Meera Chidambaram"
        stage = "followup"
        value = 65000000
        expectedCloseDate = "2026-04-15"
        priority = "Medium"
        preferredAssetClass = "Fintech Grade-A Office"
        investmentRange = "5 Cr - 10 Cr"
        notes = "Shared financial model and escalation schedule. Follow-up call requested for next week."
    },
    @{
        title = "Hyperscale Data Center Unit 3"
        customerName = "Aditya Birla Singhal"
        stage = "converted"
        value = 120000000
        expectedCloseDate = "2026-03-20"
        priority = "High"
        preferredAssetClass = "Industrial & Data Centers"
        investmentRange = "10 Cr - 15 Cr"
        notes = "Agreement signed and funds transferred to escrow account."
    }
)

foreach ($deal in $deals) {
    try {
        $body = $deal | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "http://localhost:5106/api/ghl/deals" -Method Post -Headers $headers -Body $body
        Write-Host "Created Deal: $($res.data.title) (Id: $($res.data.id))"
    } catch {
        Write-Host "Failed to create deal $($deal.title): $_"
    }
}

# 3. Seed Opportunities
$opps = @(
    @{
        title = "ORR Tech Park Pre-Leased Level 4 (9.1% Gross Yield)"
        investorName = "Venkatraman Narayanan"
        investorId = if ($createdInvestors["Venkatraman Narayanan"]) { $createdInvestors["Venkatraman Narayanan"] } else { 1 }
        stage = "Committed"
        targetAmount = 45000000
        committedAmount = 45000000
        expectedCloseDate = "2026-03-25"
        notes = "Escrow account established. Legal diligence completed by Khaitan & Co."
    },
    @{
        title = "Hosakote Mega Logistics Hub Tranche B"
        investorName = "Dr. Rajesh Nambiar"
        investorId = if ($createdInvestors["Dr. Rajesh Nambiar"]) { $createdInvestors["Dr. Rajesh Nambiar"] } else { 2 }
        stage = "Opportunity"
        targetAmount = 35000000
        committedAmount = 20000000
        expectedCloseDate = "2026-04-15"
        notes = "12-year lease with Fortune 500 ecommerce tenant. Annual escalation 5%."
    },
    @{
        title = "Whitefield Cyber Hub Grade-A Pre-Leased Floor (8.8% Yield)"
        investorName = "Siddharth Singhania"
        investorId = if ($createdInvestors["Siddharth Singhania"]) { $createdInvestors["Siddharth Singhania"] } else { 3 }
        stage = "Committed"
        targetAmount = 150000000
        committedAmount = 150000000
        expectedCloseDate = "2026-03-30"
        notes = "MNC banking tenant on 9-year lock-in. Escrow terms agreed."
    },
    @{
        title = "Outer Ring Road Fintech Center Tranche A"
        investorName = "Meera Chidambaram"
        investorId = if ($createdInvestors["Meera Chidambaram"]) { $createdInvestors["Meera Chidambaram"] } else { 4 }
        stage = "Opportunity"
        targetAmount = 65000000
        committedAmount = 65000000
        expectedCloseDate = "2026-04-10"
        notes = "Due diligence stage with legal advisors."
    },
    @{
        title = "Electronic City Cloud Data Park Unit 3"
        investorName = "Aditya Birla Singhal"
        investorId = if ($createdInvestors["Aditya Birla Singhal"]) { $createdInvestors["Aditya Birla Singhal"] } else { 5 }
        stage = "Qualified"
        targetAmount = 120000000
        committedAmount = 80000000
        expectedCloseDate = "2026-05-15"
        notes = "Technical feasibility report reviewed by institutional consultant."
    }
)

foreach ($opp in $opps) {
    try {
        $body = $opp | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "http://localhost:5106/api/ghl/investment-opportunities" -Method Post -Headers $headers -Body $body
        Write-Host "Created Opportunity: $($res.data.title) (Id: $($res.data.id))"
    } catch {
        Write-Host "Failed to create opportunity $($opp.title): $_"
    }
}

Write-Host "Seeding complete!"
