const http = require('http');

function post(path, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: 'localhost',
      port: 5106,
      path: path,
      method: 'POST',
      headers: headers
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5106,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testCrud() {
  const loginRes = await post('/api/auth/login', { email: 'vikram@ghlindiatrust.com', password: 'Password@123' });
  const token = loginRes.data?.data?.token;

  console.log('1. Testing POST /api/ghl/investors...');
  const invRes = await post('/api/ghl/investors', {
    name: 'Ananya Singhal',
    phone: '+91 99881 22334',
    email: 'ananya.singhal@testfamilyoffice.com',
    status: 'Active',
    investmentCapacity: '₹5 Cr - ₹10 Cr',
    preferredAssetClass: 'Pre-IPO Tech & Private Credit',
    referralSource: 'Board Member',
    committedAUM: '₹7.5 Cr',
    investmentMandate: 'Targeting 22%+ IRR in co-investment opportunities',
    riskTolerance: 'Aggressive',
    notes: 'Key decision maker for family trust.'
  }, token);
  const createdInvId = invRes.data?.data?.id || invRes.data?.id;
  console.log('   Investor Created -> Status:', invRes.status, '| ID:', createdInvId);

  console.log('2. Testing POST /api/ghl/investment-opportunities...');
  const oppRes = await post('/api/ghl/investment-opportunities', {
    title: 'Cyber City Tech Tower Co-AIF II',
    investorId: createdInvId || 7,
    investorName: 'Ananya Singhal',
    stage: 'Opportunity',
    targetAmount: 50000000,
    committedAmount: 25000000,
    expectedCloseDate: '2026-11-30',
    notes: 'Pre-vetted institutional opportunity.'
  }, token);
  const createdOppId = oppRes.data?.data?.id || oppRes.data?.id;
  console.log('   Opportunity Created -> Status:', oppRes.status, '| ID:', createdOppId);

  console.log('3. Testing POST /api/ghl/deals/7/activities...');
  const actRes = await post('/api/ghl/deals/7/activities', {
    type: 'Note',
    description: 'Verified investment mandate during client review call.',
    sentiment: 'Positive'
  }, token);
  console.log('   Deal Activity Created -> Status:', actRes.status);

  console.log('\n4. Verifying updated counts via GET...');
  const investors = await get('/api/ghl/investors', token);
  console.log('   GET /api/ghl/investors -> Status:', investors.status, '| Total count:', investors.data?.data?.totalCount, '| Items:', investors.data?.data?.items?.length);

  const opps = await get('/api/ghl/investment-opportunities', token);
  console.log('   GET /api/ghl/investment-opportunities -> Status:', opps.status, '| Total count:', opps.data?.data?.totalCount, '| Items:', opps.data?.data?.items?.length);

  const deals = await get('/api/ghl/deals', token);
  console.log('   GET /api/ghl/deals -> Status:', deals.status, '| Total count:', deals.data?.data?.totalCount, '| Items:', deals.data?.data?.items?.length);
}

testCrud();
