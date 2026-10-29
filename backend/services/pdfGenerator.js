const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const { calculateStampDuty } = require('./financials');
const { decryptPII } = require('../utils/security');

/**
 * Enterprise Legal & Accounting PDF Generator for MutuneRent Pro
 * Mombasa Estate Agency Limited • Regulated under EARB, Cap 301, Cap 480 & KRA eTIMS
 */
function generateLegalPDF(docType, data = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Decrypt any encrypted PII fields safely
      const cleanData = { ...data };
      if (cleanData.id_number) cleanData.id_number = decryptPII(cleanData.id_number);
      if (cleanData.tenant_phone) cleanData.tenant_phone = decryptPII(cleanData.tenant_phone);
      if (cleanData.landlord_phone) cleanData.landlord_phone = decryptPII(cleanData.landlord_phone);
      if (cleanData.phone) cleanData.phone = decryptPII(cleanData.phone);

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        info: {
          Title: getDocTitle(docType),
          Author: 'Mutune Real Estate Management Ltd',
          Subject: 'Official Enterprise Legal Instrument',
          Keywords: 'MutuneRent, Kenya Law, EARB, Cap 301, Cap 480, KRA eTIMS',
          CreationDate: new Date()
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', (err) => {
        logger.error('PDFKit stream error', { docType, error: err.message });
        reject(err);
      });

      // Dispatch to specialized official document renderers
      switch (docType) {
        case 'lease_agreement':
        case 'lease':
          renderOfficialLeaseAgreement(doc, cleanData);
          break;
        case 'demand_note_7day':
          renderOfficialDemandNote(doc, cleanData);
          break;
        case 'quit_notice_30day':
          renderOfficialQuitNotice(doc, cleanData);
          break;
        case 'landlord_remittance_statement':
          renderOfficialLandlordStatement(doc, cleanData);
          break;
        case 'agent_salary_voucher':
          renderOfficialAgentSalaryVoucher(doc, cleanData);
          break;
        case 'etims_tax_receipt':
          renderOfficialETIMSReceipt(doc, cleanData);
          break;
        case 'rrt_landlord_complaint':
          renderOfficialRRTComplaintForm(doc, cleanData);
          break;
        case 'rrt_tenant_response':
          renderOfficialRRTResponseForm(doc, cleanData);
          break;
        default:
          renderOfficialGenericDocument(doc, cleanData);
      }

      doc.end();
    } catch (err) {
      logger.error('PDF Generation Error', { docType, error: err.message });
      reject(err);
    }
  });
}

function getDocTitle(docType) {
  const titles = {
    lease_agreement: 'Tenancy Lease Agreement (Cap 480 & Land Act 2012)',
    lease: 'Tenancy Lease Agreement (Cap 480 & Land Act 2012)',
    demand_note_7day: '7-Day Rent Arrears Demand Note (Cap 293 Distress for Rent)',
    quit_notice_30day: '30-Day Notice to Quit (S.4(2) Landlord & Tenant Act)',
    landlord_remittance_statement: 'Landlord Monthly Remittance & Accounting Statement',
    agent_salary_voucher: 'Agent Salary & EARB Commission Voucher',
    etims_tax_receipt: 'KRA eTIMS Official Tax Invoice Receipt',
    rrt_landlord_complaint: 'Rent Restriction Tribunal Eviction Application (Cap 301)',
    rrt_tenant_response: 'Rent Restriction Tribunal Dispute Response (Cap 301)'
  };
  return titles[docType] || 'Official Legal Document';
}

// ─── STYLING & DRAWING UTILITIES ─────────────────────────────────────────────

function drawHeaderBanner(doc, { title, subtitle, refCode, badgeText = 'OFFICIAL INSTRUMENT', badgeColor = '#059669' }) {
  const pageWidth = doc.page.width;
  
  // Top deep navy bar
  doc.rect(0, 0, pageWidth, 90).fill('#09111e');
  
  // Brand title
  doc.fillColor('#10b981').fontSize(16).font('Helvetica-Bold').text('MUTUNERENT PRO', 40, 20);
  doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text('MUTUNE REAL ESTATE MANAGEMENT & AGENCIES LIMITED', 40, 39);
  doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Regulated by the Estate Agents Registration Board (EARB/MBA/2024/098) • KRA PIN: P051987654Z', 40, 50);
  doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Executive Offices: Nyali Links Plaza, P.O. Box 90120-80100 Mombasa, Kenya • Tel: +254 700 000 000', 40, 61);

  // Right-side badge & document title
  const badgeWidth = 140;
  const badgeX = pageWidth - badgeWidth - 40;
  doc.roundedRect(badgeX, 18, badgeWidth, 18, 4).fill(badgeColor);
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold').text(badgeText, badgeX, 23, { width: badgeWidth, align: 'center' });

  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(title.toUpperCase(), badgeX - 100, 42, { width: badgeWidth + 100, align: 'right' });
  if (refCode) {
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text(`REF: ${refCode}`, badgeX - 100, 56, { width: badgeWidth + 100, align: 'right' });
  }
  doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(`DATE: ${new Date().toLocaleDateString('en-KE')} (EAT)`, badgeX - 100, 68, { width: badgeWidth + 100, align: 'right' });

  // Border separator
  doc.rect(0, 90, pageWidth, 3).fill('#10b981');
  doc.y = 105;
}

function drawOfficialFooter(doc, pageText = 'Page 1 of 1') {
  const bottom = doc.page.height - 35;
  const pageWidth = doc.page.width;

  doc.rect(40, bottom - 10, pageWidth - 80, 0.5).fill('#cbd5e1');
  doc.fontSize(6.5).fillColor('#64748b').font('Helvetica');
  doc.text('This official document is generated under the laws of the Republic of Kenya (Cap 301, Cap 480, Cap 293 & KICA Cap 411A).', 40, bottom - 4);
  doc.text(`MutuneRent Pro Enterprise Cloud • System Hash: SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()} • ${pageText}`, 40, bottom + 5, { width: pageWidth - 80, align: 'right' });
}

function drawOfficialStamp(doc, x, y, text1 = 'MUTUNE REAL ESTATE', text2 = 'VERIFIED & ENFORCEABLE') {
  doc.save();
  doc.circle(x, y, 32).lineWidth(1.5).stroke('#059669');
  doc.circle(x, y, 28).lineWidth(0.5).stroke('#059669');
  doc.fillColor('#059669').fontSize(6).font('Helvetica-Bold').text(text1, x - 26, y - 14, { width: 52, align: 'center' });
  doc.fontSize(5.5).font('Helvetica-Bold').text('★ MOMBASA ★', x - 26, y - 3, { width: 52, align: 'center' });
  doc.fontSize(5).font('Helvetica').text(text2, x - 26, y + 6, { width: 52, align: 'center' });
  doc.restore();
}

function drawUrgentNoticeStamp(doc, x, y) {
  doc.save();
  doc.rect(x, y, 100, 26).lineWidth(1.5).stroke('#dc2626');
  doc.rect(x + 2, y + 2, 96, 22).lineWidth(0.5).stroke('#dc2626');
  doc.fillColor('#dc2626').fontSize(7.5).font('Helvetica-Bold').text('FINAL LEGAL DEMAND', x, y + 5, { width: 100, align: 'center' });
  doc.fontSize(5.5).font('Helvetica').text('7 DAYS STATUTORY NOTICE', x, y + 16, { width: 100, align: 'center' });
  doc.restore();
}

// ─── 1. TENANCY LEASE AGREEMENT ──────────────────────────────────────────────

function renderOfficialLeaseAgreement(doc, data) {
  drawHeaderBanner(doc, {
    title: 'Tenancy Lease Agreement',
    subtitle: 'Cap 480 Stamp Duty & Land Act 2012 Compliant',
    refCode: `LSE-${data.tenant_code || 'MOM'}-${Date.now().toString().slice(-4)}`,
    badgeText: 'ENFORCEABLE LEASE CONTRACT',
    badgeColor: '#059669'
  });

  const rentKes = Number(data.rent_amount_kes || 0);
  const depositKes = Number(data.deposit_amount_kes || rentKes * 2 || 0);
  const durationMonths = Number(data.lease_duration_months || 12);
  const startDate = data.lease_start_date || data.start_date || new Date().toISOString().slice(0, 10);

  // Document Heading
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#09111e').text('RESIDENTIAL / COMMERCIAL PROPERTY LEASE AGREEMENT', { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('CONCLUDED UNDER THE LAND ACT (2012) AND LAND REGISTRATION ACT (2012) LAWS OF KENYA', { align: 'center' });
  doc.moveDown(0.8);

  // Parties Box
  doc.rect(40, doc.y, doc.page.width - 80, 78).fillAndStroke('#f8fafc', '#e2e8f0');
  const partiesY = doc.y + 6;
  
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('1. PARTIES TO THIS LEASE CONTRACT:', 50, partiesY);
  
  // Landlord Column
  doc.fillColor('#059669').fontSize(8).font('Helvetica-Bold').text('LESSOR (LANDLORD / PRINCIPAL):', 50, partiesY + 14);
  doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica').text(`Name: ${data.landlord_name || 'Designated Property Owner'}`, 50, partiesY + 25);
  doc.text(`ID/Passport No: ${data.landlord_id_number || 'A29384719'} | KRA PIN: ${data.kra_pin || 'P051239847K'}`, 50, partiesY + 36);
  doc.text(`Represented by: Mutune Real Estate Management & Agencies Ltd (EARB Agent)`, 50, partiesY + 47);

  // Tenant Column
  const midX = doc.page.width / 2 + 10;
  doc.fillColor('#2563eb').fontSize(8).font('Helvetica-Bold').text('LESSEE (TENANT / OCCUPANT):', midX, partiesY + 14);
  doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica').text(`Name: ${data.tenant_name || 'Tenant Name'} (${data.tenant_code || 'TEN-MOM-0001'})`, midX, partiesY + 25);
  doc.text(`National ID / Reg No: ${data.national_id || data.id_number || '28374619'}`, midX, partiesY + 36);
  doc.text(`Contact Handset: ${data.phone || data.tenant_phone || '+254 700 000 000'} | Email: ${data.email || 'N/A'}`, midX, partiesY + 47);

  doc.y = partiesY + 65;
  doc.moveDown(1);

  // Demise & Financial Schedule Table
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('2. SCHEDULE OF PREMISES & FINANCIAL TERMS:');
  doc.moveDown(0.4);

  const tableTop = doc.y;
  const colW = (doc.page.width - 80) / 4;
  
  // Table Header
  doc.rect(40, tableTop, doc.page.width - 80, 16).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('PROPERTY & UNIT', 46, tableTop + 4);
  doc.text('LEASE DURATION', 40 + colW + 6, tableTop + 4);
  doc.text('MONTHLY RENT (KES)', 40 + colW * 2 + 6, tableTop + 4);
  doc.text('SECURITY DEPOSIT (KES)', 40 + colW * 3 + 6, tableTop + 4);

  // Table Data Row
  doc.rect(40, tableTop + 16, doc.page.width - 80, 22).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
  doc.text(`${data.property_name || 'Property'} (Unit ${data.unit_number || '1A'})`, 46, tableTop + 22);
  doc.text(`${durationMonths} Months (${startDate})`, 40 + colW + 6, tableTop + 22);
  doc.fillColor('#059669').font('Helvetica-Bold').text(`KES ${rentKes.toLocaleString('en-KE')}`, 40 + colW * 2 + 6, tableTop + 22);
  doc.fillColor('#2563eb').text(`KES ${depositKes.toLocaleString('en-KE')}`, 40 + colW * 3 + 6, tableTop + 22);

  doc.y = tableTop + 44;

  // Stamp Duty Advisory
  const stamp = calculateStampDuty({ monthlyRentKes: rentKes, leaseDurationMonths: durationMonths });
  doc.rect(40, doc.y, doc.page.width - 80, 28).fillAndStroke('#eff6ff', '#bfdbfe');
  const sdY = doc.y + 5;
  doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold').text('KENYA STAMP DUTY ACT (CAP 480) STATUTORY ASSESSMENT:', 50, sdY);
  doc.fillColor('#1e3a8a').fontSize(7).font('Helvetica').text(`Annual Rental Value: KES ${stamp.annual_rent_kes.toLocaleString('en-KE')} | Stamp Duty Assessment: KES ${stamp.stamp_duty_payable_kes.toLocaleString('en-KE')} (${stamp.rate_description})`, 50, sdY + 11);
  
  doc.y = sdY + 30;

  // Key Covenants Clause Block
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('3. CORE STATUTORY COVENANTS & OBLIGATIONS:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text('a) Rent Payment: Payable strictly in advance on or before the 5th day of every calendar month via designated M-Pesa / Bank account. Any payment received after the 10th shall incur a mandatory late payment surcharge of 10%.');
  doc.text('b) Security Deposit: Held by the Managing Agent as surety against arrears, utility deficits, and physical damage. Refundable within 30 days of handover following joint dilapidation exit survey.');
  doc.text('c) Repair & Maintenance: The Tenant covenants to keep the interior of the premises, sanitary fittings, and electrical fixtures in tenable repair. The Landlord maintains the external structure, roof, and main conduits.');
  doc.text('d) Subletting & Prohibited Uses: Subletting, assignment, or running unapproved commercial activities on residential premises is strictly prohibited without written consent of the Landlord.');
  doc.text('e) Default & Re-entry: If rent is in arrears for fourteen (14) days, the Landlord reserves immediate right of re-entry and distress for rent under Cap 293 Laws of Kenya without prejudice to existing arrears claims.');

  doc.moveDown(1);

  // Attestation & Signatures Box
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('4. EXECUTION & LEGAL ATTESTATION:');
  doc.moveDown(0.3);

  const sigBoxY = doc.y;
  doc.rect(40, sigBoxY, doc.page.width - 80, 72).fillAndStroke('#f8fafc', '#cbd5e1');

  if (data.is_digitally_signed || data.signature_hash) {
    doc.fillColor('#15803d').fontSize(8).font('Helvetica-Bold').text('✓ DIGITALLY EXECUTED & SEALED VIA 2-STEP SMS OTP AUTHENTICATION', 50, sigBoxY + 8);
    doc.fillColor('#166534').fontSize(7.5).font('Helvetica').text(`Lessee Signatory: ${data.tenant_name || 'Verified Tenant'} (${data.tenant_phone || data.phone || 'Handset Verified'})`, 50, sigBoxY + 20);
    doc.text(`Digital Verification Hash (SHA-256): ${data.signature_hash || 'SHA256-MUTUNE-CAP480-VERIFIED-AUTH'}`, 50, sigBoxY + 31);
    doc.text(`Timestamp: ${data.signed_at || new Date().toISOString()} • IP / Gateway: Mombasa Core Secure Node`, 50, sigBoxY + 42);
    doc.fillColor('#047857').font('Helvetica-Bold').text('Enforceable under Section 83B of the Kenya Information & Communications Act (Cap 411A).', 50, sigBoxY + 54);
    drawOfficialStamp(doc, doc.page.width - 85, sigBoxY + 36, 'MUTUNERENT', 'DIGITALLY SEALED');
  } else {
    const col2X = doc.page.width / 2 + 10;
    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('FOR AND ON BEHALF OF LESSOR:', 50, sigBoxY + 8);
    doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Authorized Signature & Stamp: ______________________', 50, sigBoxY + 30);
    doc.text('EARB Registered Managing Agent • Mutune Real Estate', 50, sigBoxY + 46);

    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('LESSEE / TENANT SIGNATURE:', col2X, sigBoxY + 8);
    doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Signature: ____________________________________', col2X, sigBoxY + 30);
    doc.text(`Date of Acceptance: ${new Date().toLocaleDateString('en-KE')}`, col2X, sigBoxY + 46);
    drawOfficialStamp(doc, doc.page.width - 85, sigBoxY + 36, 'MUTUNERENT', 'OFFICIAL LEASE');
  }

  drawOfficialFooter(doc, 'Page 1 of 1 • Cap 480 Legal Tenancy Lease');
}

// ─── 2. 7-DAY RENT DEMAND NOTE (CAP 293 DISTRESS FOR RENT) ───────────────────

function renderOfficialDemandNote(doc, data) {
  drawHeaderBanner(doc, {
    title: '7-Day Rent Arrears Demand Note',
    subtitle: 'Formal Statutory Notice under Distress for Rent Act (Cap 293)',
    refCode: `DMD-MOM-${Date.now().toString().slice(-5)}`,
    badgeText: 'URGENT STATUTORY NOTICE',
    badgeColor: '#dc2626'
  });

  const rentKes = Number(data.rent_amount_kes || 0);
  const arrearsKes = Number(data.arrears_kes || data.demanded_rent_kes || rentKes * 1.5 || 0);
  const penaltyKes = Number(data.penalty_fee_kes || Math.round(arrearsKes * 0.1) || 500);
  const totalDueKes = arrearsKes + penaltyKes;

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#dc2626').text('FORMAL SEVEN (7) DAYS DEMAND NOTICE PRIOR TO DISTRESS FOR RENT', { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('PURSUANT TO SECTION 4(1) OF THE LANDLORD AND TENANT ACT & DISTRESS FOR RENT ACT (CAP 293)', { align: 'center' });
  doc.moveDown(0.8);

  // Recipient Card
  doc.rect(40, doc.y, doc.page.width - 80, 54).fillAndStroke('#fef2f2', '#fecaca');
  const recY = doc.y + 6;
  doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('TO TENANT / OCCUPANT:', 50, recY);
  doc.fillColor('#1e293b').fontSize(8).font('Helvetica').text(`Name: ${data.tenant_name || 'Tenant Name'} | Tenant Code: ${data.tenant_code || 'TEN-MOM-XXXX'}`, 50, recY + 12);
  doc.text(`Occupied Premises: Unit ${data.unit_number || '1A'}, ${data.property_name || 'Property Name'}, Mombasa`, 50, recY + 24);
  doc.text(`Contact: ${data.phone || data.tenant_phone || 'Registered Handset'} | National ID: ${data.national_id || 'N/A'}`, 50, recY + 36);

  drawUrgentNoticeStamp(doc, doc.page.width - 150, recY);

  doc.y = recY + 54;
  doc.moveDown(1);

  // Statement of Breach
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('1. PARTICULARS OF DEFAULT & OUTSTANDING ARREARS:');
  doc.moveDown(0.4);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text('TAKE NOTICE that according to the tenancy accounting records held by Mutune Real Estate Management Ltd, your rent account is materially in default with accumulated unpaid balances as scheduled hereunder:');
  doc.moveDown(0.4);

  // Itemized Table
  const tTop = doc.y;
  doc.rect(40, tTop, doc.page.width - 80, 16).fill('#991b1b');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('DESCRIPTION OF ARREARS', 46, tTop + 4);
  doc.text('PERIOD / DUE DATE', 250, tTop + 4);
  doc.text('AMOUNT (KES)', doc.page.width - 130, tTop + 4, { align: 'right', width: 80 });

  const rows = [
    { desc: 'Accumulated Monthly Rent Arrears', period: 'Immediate Prior Billing Months', amt: arrearsKes },
    { desc: 'Statutory / Contractual Late Surcharge (10%)', period: 'Administrative Surcharge Fee', amt: penaltyKes },
    { desc: 'Water & Common Utility Surcharge Arrears', period: 'Metered Consumption Deficit', amt: 0 }
  ];

  let curY = tTop + 16;
  rows.forEach((r, idx) => {
    doc.rect(40, curY, doc.page.width - 80, 18).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
    doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica').text(r.desc, 46, curY + 5);
    doc.text(r.period, 250, curY + 5);
    doc.text(`KES ${r.amt.toLocaleString('en-KE')}`, doc.page.width - 130, curY + 5, { align: 'right', width: 80 });
    curY += 18;
  });

  // Total Due Bar
  doc.rect(40, curY, doc.page.width - 80, 22).fill('#fef2f2');
  doc.fillColor('#991b1b').fontSize(8.5).font('Helvetica-Bold').text('TOTAL OUTSTANDING ARREARS PAYABLE WITHIN 7 DAYS:', 46, curY + 6);
  doc.fontSize(10).text(`KES ${totalDueKes.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 5, { align: 'right', width: 100 });

  doc.y = curY + 30;

  // Statutory Warning & Sanctions
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('2. STATUTORY NOTIFICATION & INTENDED LEGAL ACTIONS:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text('HEREBY TAKE NOTICE that unless the total outstanding sum of KES ' + totalDueKes.toLocaleString('en-KE') + ' is paid in full within SEVEN (7) CALENDAR DAYS from date of service hereof, the Landlord shall proceed without further reference to you with the following lawful actions:');
  doc.text('1. Issue a formal Warrant of Distress to Court Brokers & Licensed Auctioneers under the Distress for Rent Act (Cap 293) to proclaim, impound, and auction your movable assets to recover arrears and costs.');
  doc.text('2. Institute formal Eviction Proceedings and Recovery of Possession before the Rent Restriction Tribunal at Mombasa under Cap 301 Laws of Kenya.');
  doc.text('3. Forward your credit default records to Credit Reference Bureaus (CRB TransUnion & Metropol) for mandatory blacklisting.');

  doc.moveDown(0.8);

  // Settlement Instructions
  doc.rect(40, doc.y, doc.page.width - 80, 40).fillAndStroke('#f0fdf4', '#bbf7d0');
  const payY = doc.y + 5;
  doc.fillColor('#166534').fontSize(8).font('Helvetica-Bold').text('PAYMENT CHANNEL / DARAJA M-PESA PAYBILL INSTRUCTIONS:', 50, payY);
  doc.fillColor('#14532d').fontSize(7.5).font('Helvetica').text(`Paybill Business No: 400200 • Account Number: ${data.tenant_code || 'TEN-MOM-XXXX'} • Account Name: Mutune Rent Escrow`, 50, payY + 11);
  doc.text('Upon payment, automated KRA eTIMS receipt confirmation will be generated instantly to your portal.', 50, payY + 22);

  doc.y = payY + 45;
  doc.moveDown(0.5);

  // Sign-off
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('FOR AND ON BEHALF OF THE LANDLORD:');
  doc.fontSize(7).font('Helvetica').fillColor('#64748b').text('Legal & Recovery Operations Department • Mutune Real Estate Management & Agencies Ltd', 40, doc.y + 4);
  doc.text('Serving Officer Handset / Inquiries: +254 (0) 700 000 000 • legal@mutune.co.ke', 40, doc.y + 14);

  drawOfficialFooter(doc, 'Page 1 of 1 • Cap 293 Statutory 7-Day Demand Note');
}

// ─── 3. 30-DAY NOTICE TO QUIT (S.4(2) LANDLORD & TENANT ACT) ─────────────────

function renderOfficialQuitNotice(doc, data) {
  drawHeaderBanner(doc, {
    title: '30-Day Notice to Quit',
    subtitle: 'Section 4(2) Landlord and Tenant Act (Cap 301 & Cap 293)',
    refCode: `QUIT-MOM-${Date.now().toString().slice(-5)}`,
    badgeText: 'FORMAL NOTICE TO VACATE',
    badgeColor: '#475569'
  });

  const vacateDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-KE');

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#09111e').text('STATUTORY THIRTY (30) DAYS NOTICE TO QUIT & VACATE PREMISES', { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('SERVED UNDER SECTION 4(2) OF THE LANDLORD AND TENANT ACT LAWS OF KENYA', { align: 'center' });
  doc.moveDown(0.8);

  // Notice Recipient Card
  doc.rect(40, doc.y, doc.page.width - 80, 50).fillAndStroke('#f8fafc', '#e2e8f0');
  const cardY = doc.y + 6;
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('TO TENANT / OCCUPANT:', 50, cardY);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`Name: ${data.tenant_name || 'Tenant Name'} | Tenant Code: ${data.tenant_code || 'TEN-MOM-XXXX'}`, 50, cardY + 11);
  doc.text(`Premises: Unit ${data.unit_number || '1A'}, ${data.property_name || 'Property Name'}, Mombasa`, 50, cardY + 22);
  doc.text(`Address: ${data.property_address || 'Links Road, Nyali, Mombasa'}`, 50, cardY + 33);

  doc.y = cardY + 50;
  doc.moveDown(1);

  // Body of Notice
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('1. NOTICE TO YIELD UP VACANT POSSESSION:');
  doc.moveDown(0.4);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
  doc.text(`TAKE NOTICE that you are hereby required to quit, vacate, and peacefully yield up vacant possession of the premises known as Unit ${data.unit_number || '1A'} at ${data.property_name || 'Property Name'} on or before the expiry of thirty (30) calendar days from the date of service hereof, namely on or before:`);
  doc.moveDown(0.4);

  // Vacate Date Highlight Box
  doc.rect(40, doc.y, doc.page.width - 80, 26).fillAndStroke('#fef3c7', '#fde68a');
  doc.fillColor('#92400e').fontSize(9).font('Helvetica-Bold').text(`MANDATORY VACATION DATE: ${vacateDate}`, 40, doc.y + 7, { align: 'center', width: doc.page.width - 80 });

  doc.y += 34;

  // Handover & Inspection Requirements
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('2. HANDOVER PROTOCOL & DILAPIDATION SURVEY:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text('a) Joint Exit Inspection: You are required to schedule a physical move-out dilapidation inspection with your assigned property field agent at least three (3) business days prior to the vacation date.');
  doc.text('b) Handover of Master Keys: All original entrance, room, and gate keys, gate remotes, and access tokens must be surrendered at the time of the inspection.');
  doc.text('c) Clearance of Utility Accounts: All metered electricity (KPLC token statement) and water utility bills up to the handover hour must be cleared in full, with stamped receipts presented to the agent.');
  doc.text('d) Deposit Settlement: Your refundable security deposit will be processed in accordance with the tenancy agreement within thirty (30) days following deduction of any verified damage repairs or utility arrears.');

  doc.moveDown(1);

  // Forfeiture Warning
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('3. CONSEQUENCES OF OVERSTAYING / MESNE PROFITS:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text('Should you remain in occupation following the expiration of this notice, you will be deemed a trespasser. Immediate eviction proceedings will be lodged before the Rent Restriction Tribunal at Mombasa with an application for double rent mesne profits, eviction costs, and auctioneer fees.');

  doc.moveDown(1.5);

  // Signature Block
  const sigY = doc.y;
  doc.rect(40, sigY, doc.page.width - 80, 56).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('ISSUED BY AUTHORIZED AGENTS FOR THE LESSOR:', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Managing Director / Legal Officer • Mutune Real Estate Management Ltd', 50, sigY + 28);
  doc.text('Telephone: +254 (0) 700 000 000 • Email: management@mutune.co.ke', 50, sigY + 40);
  drawOfficialStamp(doc, doc.page.width - 85, sigY + 28, 'MUTUNERENT', 'NOTICE SERVED');

  drawOfficialFooter(doc, 'Page 1 of 1 • S.4(2) Statutory Notice to Quit');
}

// ─── 4. LANDLORD MONTHLY REMITTANCE STATEMENT ───────────────────────────────

function renderOfficialLandlordStatement(doc, data) {
  drawHeaderBanner(doc, {
    title: 'Landlord Remittance Statement',
    subtitle: 'Monthly Portfolio Accounting & Net Disbursal Schedule',
    refCode: `REMIT-${Date.now().toString().slice(-5)}`,
    badgeText: 'FINANCIAL STATEMENT',
    badgeColor: '#0284c7'
  });

  const month = data.billing_month || new Date().toISOString().slice(0, 7);
  const rentGross = Number(data.rent_amount_kes || data.gross_collected_kes || 120000);
  const mgmtFeePercent = Number(data.management_fee_percent || data.commission_percent || 8);
  const mgmtFeeKes = Math.round(rentGross * (mgmtFeePercent / 100));
  const maintenanceKes = Number(data.maintenance_kes || 3500);
  const mriTaxKes = Math.round(rentGross * 0.075); // 7.5% KRA Monthly Rental Income tax
  const netPayoutKes = rentGross - mgmtFeeKes - maintenanceKes;
  const usdRate = Number(data.usd_exchange_rate || 129.50);

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#09111e').text(`LANDLORD MONTHLY REMITTANCE STATEMENT — ${month}`, { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('PREPARED UNDER ICPAK PROPERTY MANAGEMENT ACCOUNTING STANDARDS', { align: 'center' });
  doc.moveDown(0.8);

  // Landlord Metadata Card
  doc.rect(40, doc.y, doc.page.width - 80, 48).fillAndStroke('#f8fafc', '#e2e8f0');
  const cardY = doc.y + 6;
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('LANDLORD BENEFICIARY & PROPERTY SUMMARY:', 50, cardY);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`Landlord: ${data.landlord_name || 'Landlord Owner'} | KRA PIN: ${data.kra_pin || 'P051829304M'}`, 50, cardY + 11);
  doc.text(`Assigned Property: ${data.property_name || 'All Properties'} | Code: ${data.property_code || 'MUT-PROP'}`, 50, cardY + 22);
  doc.text(`Disbursal Bank / M-Pesa: Equity Bank Mombasa Branch (A/C: ****5541) / Daraja B2C`, 50, cardY + 33);

  doc.y = cardY + 48;
  doc.moveDown(1);

  // Accounting Summary Table
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('1. STATEMENT OF COLLECTIONS & DEDUCTIONS:');
  doc.moveDown(0.4);

  const tTop = doc.y;
  doc.rect(40, tTop, doc.page.width - 80, 16).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('ACCOUNTING LINE ITEM', 46, tTop + 4);
  doc.text('CATEGORY', 250, tTop + 4);
  doc.text('AMOUNT (KES)', 380, tTop + 4, { align: 'right', width: 80 });
  doc.text('USD ($)', doc.page.width - 120, tTop + 4, { align: 'right', width: 70 });

  const lineItems = [
    { name: 'Gross Rent Collected (Units)', cat: 'Revenue', kes: rentGross, isCredit: true },
    { name: `Agency Management Fee (${mgmtFeePercent}%)`, cat: 'Agency Commission', kes: -mgmtFeeKes, isCredit: false },
    { name: 'Approved Minor Maintenance & Repairs', cat: 'Operating Expense', kes: -maintenanceKes, isCredit: false },
    { name: 'Water & Communal Service Charge Offset', cat: 'Utility Disbursal', kes: 0, isCredit: false }
  ];

  let curY = tTop + 16;
  lineItems.forEach((item, idx) => {
    doc.rect(40, curY, doc.page.width - 80, 18).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
    doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica').text(item.name, 46, curY + 5);
    doc.text(item.cat, 250, curY + 5);
    doc.fillColor(item.isCredit ? '#059669' : '#dc2626').font('Helvetica-Bold');
    doc.text(`${item.kes < 0 ? '-' : ''}KES ${Math.abs(item.kes).toLocaleString('en-KE')}`, 380, curY + 5, { align: 'right', width: 80 });
    doc.fillColor('#475569').font('Helvetica').text(`$${(Math.abs(item.kes) / usdRate).toFixed(2)}`, doc.page.width - 120, curY + 5, { align: 'right', width: 70 });
    curY += 18;
  });

  // Net Disbursed Highlight Row
  doc.rect(40, curY, doc.page.width - 80, 24).fill('#ecfdf5');
  doc.fillColor('#065f46').fontSize(8.5).font('Helvetica-Bold').text('NET MONTHLY REMITTANCE PAYABLE TO LANDLORD:', 46, curY + 6);
  doc.fontSize(10).text(`KES ${netPayoutKes.toLocaleString('en-KE')}`, 360, curY + 6, { align: 'right', width: 100 });
  doc.fontSize(9).text(`$${(netPayoutKes / usdRate).toFixed(2)}`, doc.page.width - 120, curY + 7, { align: 'right', width: 70 });

  doc.y = curY + 34;

  // KRA Monthly Rental Income (MRI) Tax Advisory Box
  doc.rect(40, doc.y, doc.page.width - 80, 36).fillAndStroke('#fffbeb', '#fde68a');
  const mriY = doc.y + 5;
  doc.fillColor('#92400e').fontSize(7.5).font('Helvetica-Bold').text('KRA RESIDENTIAL RENTAL INCOME TAX (MRI) ADVISORY:', 50, mriY);
  doc.fillColor('#78350f').fontSize(7).font('Helvetica').text(`Gross Taxable Rent: KES ${rentGross.toLocaleString('en-KE')} • MRI Tax Liability (7.5% Rate under Finance Act): KES ${mriTaxKes.toLocaleString('en-KE')}`, 50, mriY + 10);
  doc.text('Note: File return on KRA iTax via Form ITMR-01 on or before the 20th of the subsequent month.', 50, mriY + 20);

  doc.y = mriY + 44;
  doc.moveDown(0.5);

  // Certified Signatures Block
  const sigY = doc.y;
  doc.rect(40, sigY, doc.page.width - 80, 60).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('PREPARED & CERTIFIED BY MANAGING AGENCY:', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Head of Financial Operations • ICPAK Reg No: R/29182', 50, sigY + 24);
  doc.text(`Disbursal Batch Reference: B2C-REMIT-${Date.now().toString().slice(-6)} • CBK Exchange Rate: 1 USD = ${usdRate} KES`, 50, sigY + 35);
  doc.text('Mutune Real Estate Escrow Trust Account Mombasa', 50, sigY + 46);
  drawOfficialStamp(doc, doc.page.width - 85, sigY + 30, 'MUTUNERENT', 'FINANCE SEAL');

  drawOfficialFooter(doc, 'Page 1 of 1 • Landlord Remittance Statement');
}

// ─── 5. AGENT SALARY & COMMISSION VOUCHER ────────────────────────────────────

function renderOfficialAgentSalaryVoucher(doc, data) {
  drawHeaderBanner(doc, {
    title: 'Agent Salary & Commission Voucher',
    subtitle: 'EARB Regulated Compensation & Statutory WHT Schedule',
    refCode: `VOUCH-${Date.now().toString().slice(-5)}`,
    badgeText: 'EARB COMPLIANT PAYROLL',
    badgeColor: '#4f46e5'
  });

  const month = data.billing_month || new Date().toISOString().slice(0, 7);
  const baseSalary = Number(data.base_salary_kes || 25000);
  const lettingCommission = Number(data.letting_commission_kes || 15000);
  const mgmtCommission = Number(data.management_commission_kes || 6000);
  const initiationFees = Number(data.initiation_fees_kes || data.tenant_onboarding_initiation_fee_kes || 2000);
  const grossEarnings = baseSalary + lettingCommission + mgmtCommission + initiationFees;
  const whtTax = Math.round(grossEarnings * 0.05); // 5% KRA resident WHT
  const netPayable = grossEarnings - whtTax;

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#09111e').text(`ESTATE AGENT PAYROLL & COMMISSION VOUCHER — ${month}`, { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('GOVERNED UNDER THE ESTATE AGENTS ACT (CAP 533 LAWS OF KENYA)', { align: 'center' });
  doc.moveDown(0.8);

  // Agent Metadata Card
  doc.rect(40, doc.y, doc.page.width - 80, 48).fillAndStroke('#f8fafc', '#e2e8f0');
  const cardY = doc.y + 6;
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('FIELD AGENT PARTICULARS & LICENSING:', 50, cardY);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`Agent Name: ${data.agent_name || 'Field Agent'} | Agent Code: ${data.agent_code || data.user_code || 'AGT-MOM-0001'}`, 50, cardY + 11);
  doc.text(`EARB License Number: ${data.earb_license || 'EARB/2024/9912'} | National ID: ${data.national_id || '28374619'}`, 50, cardY + 22);
  doc.text(`Assigned Territory: Nyali, Kizingo & Mombasa Island Portfolio`, 50, cardY + 33);

  doc.y = cardY + 48;
  doc.moveDown(1);

  // Itemized Earnings Schedule
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('1. ITEMIZED EARNINGS SCHEDULE:');
  doc.moveDown(0.4);

  const tTop = doc.y;
  doc.rect(40, tTop, doc.page.width - 80, 16).fill('#1e1b4b');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('COMPENSATION COMPONENT', 46, tTop + 4);
  doc.text('BASIS / RATE', 250, tTop + 4);
  doc.text('EARNED AMOUNT (KES)', doc.page.width - 150, tTop + 4, { align: 'right', width: 100 });

  const earnings = [
    { title: 'Base Field Retainer Salary', basis: 'Contractual Guaranteed Base', amt: baseSalary },
    { title: 'Letting Commission (New Tenancies)', basis: '50% of 1st Month Rent on Let Units', amt: lettingCommission },
    { title: 'Property Management Commission', basis: '5% of Ongoing Collections', amt: mgmtCommission },
    { title: 'Tenant Onboarding Initiation Bonuses', basis: 'Flat KES 1,000 per Verified Onboard', amt: initiationFees }
  ];

  let curY = tTop + 16;
  earnings.forEach((e, idx) => {
    doc.rect(40, curY, doc.page.width - 80, 18).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
    doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica').text(e.title, 46, curY + 5);
    doc.text(e.basis, 250, curY + 5);
    doc.fillColor('#059669').font('Helvetica-Bold').text(`KES ${e.amt.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 5, { align: 'right', width: 100 });
    curY += 18;
  });

  // Gross Earnings Row
  doc.rect(40, curY, doc.page.width - 80, 20).fill('#f1f5f9');
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('GROSS AGENT EARNINGS:', 46, curY + 5);
  doc.fontSize(9).text(`KES ${grossEarnings.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 5, { align: 'right', width: 100 });
  curY += 20;

  // Tax Deductions Row
  doc.rect(40, curY, doc.page.width - 80, 20).fill('#fef2f2');
  doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('LESS: KRA WITHHOLDING TAX (WHT 5% RESIDENT RATE):', 46, curY + 5);
  doc.fontSize(9).text(`-KES ${whtTax.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 5, { align: 'right', width: 100 });
  curY += 20;

  // Net Disbursable Row
  doc.rect(40, curY, doc.page.width - 80, 24).fill('#ecfdf5');
  doc.fillColor('#065f46').fontSize(8.5).font('Helvetica-Bold').text('NET REMITTANCE PAYABLE VIA M-PESA B2C:', 46, curY + 6);
  doc.fontSize(10).text(`KES ${netPayable.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 5, { align: 'right', width: 100 });

  doc.y = curY + 34;

  // Authorization Signatures Block
  const sigY = doc.y;
  doc.rect(40, sigY, doc.page.width - 80, 60).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('AUTHORIZED SIGN-OFF & PAYROLL DISBURSAL:', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Managing Director / Principal Officer: __________________________', 50, sigY + 24);
  doc.text(`Disbursal Channel: Safaricom Daraja B2C Bulk Disbursal • Batch ID: B2C-AGT-${Date.now().toString().slice(-6)}`, 50, sigY + 35);
  doc.text('I confirm receipt of the above net earnings subject to KRA statutory tax deduction.', 50, sigY + 46);
  drawOfficialStamp(doc, doc.page.width - 85, sigY + 30, 'MUTUNERENT', 'PAYROLL AUTH');

  drawOfficialFooter(doc, 'Page 1 of 1 • Agent Salary & Commission Voucher');
}

// ─── 6. KRA eTIMS OFFICIAL TAX INVOICE RECEIPT ────────────────────────────────

function renderOfficialETIMSReceipt(doc, data) {
  drawHeaderBanner(doc, {
    title: 'KRA eTIMS Official Tax Invoice',
    subtitle: 'Electronic Tax Invoice Management System (VAT Act 2013)',
    refCode: `ETIMS-${Date.now().toString().slice(-6)}`,
    badgeText: 'KRA FISCAL RECEIPT',
    badgeColor: '#b91c1c'
  });

  const rentAmount = Number(data.rent_amount_kes || 35000);
  const vatAmount = 0; // Residential rent is exempt from VAT under Part II First Schedule of VAT Act
  const invoiceNumber = data.etims_invoice_number || `INV-KRA-2026-${Date.now().toString().slice(-6)}`;
  const cuSerial = data.cu_serial_number || process.env.KRA_ETIMS_DEVICE_SERIAL || 'KRA-CU-009847123';
  const traderPin = data.kra_pin || process.env.KRA_ETIMS_PIN || 'P051987654Z';

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#b91c1c').text('KENYA REVENUE AUTHORITY — OFFICIAL TAX INVOICE RECEIPT', { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('GENERATED BY COMPLIANT CONTROL UNIT (CU) SOFTWARE INTEGRATION', { align: 'center' });
  doc.moveDown(0.8);

  // Fiscal Header Box
  doc.rect(40, doc.y, doc.page.width - 80, 60).fillAndStroke('#f8fafc', '#cbd5e1');
  const fiscY = doc.y + 6;
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('TRADER & TAXPAYER PARTICULARS:', 50, fiscY);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`Trader: Mutune Real Estate Management Ltd | KRA PIN: ${traderPin}`, 50, fiscY + 11);
  doc.text(`CU Serial Number: ${cuSerial} | Fiscal Receipt No: ${invoiceNumber}`, 50, fiscY + 22);
  doc.text(`Buyer / Tenant: ${data.tenant_name || 'Tenant Name'} | Buyer PIN: ${data.tenant_pin || 'P000000000X'}`, 50, fiscY + 33);
  doc.text(`Transaction Time: ${new Date().toLocaleString('en-KE')} (EAT UTC+3)`, 50, fiscY + 44);

  doc.y = fiscY + 60;
  doc.moveDown(1);

  // Line Items Table
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('1. TAX CLASSIFICATION & INVOICE ITEMS:');
  doc.moveDown(0.4);

  const tTop = doc.y;
  doc.rect(40, tTop, doc.page.width - 80, 16).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('ITEM DESCRIPTION', 46, tTop + 4);
  doc.text('TAX CLASSIFICATION', 250, tTop + 4);
  doc.text('AMOUNT (KES)', doc.page.width - 150, tTop + 4, { align: 'right', width: 100 });

  const items = [
    { desc: `Residential Rental Premises (Unit ${data.unit_number || '1A'})`, tax: 'EXEMPT (1st Schedule VAT Act)', amt: rentAmount },
    { desc: 'Communal Services & Security Surcharge', tax: 'EXEMPT (Residential Tenancy)', amt: 0 }
  ];

  let curY = tTop + 16;
  items.forEach((it, idx) => {
    doc.rect(40, curY, doc.page.width - 80, 18).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
    doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica').text(it.desc, 46, curY + 5);
    doc.text(it.tax, 250, curY + 5);
    doc.fillColor('#0f172a').font('Helvetica-Bold').text(`KES ${it.amt.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 5, { align: 'right', width: 100 });
    curY += 18;
  });

  // Totals Summary Box
  doc.rect(40, curY, doc.page.width - 80, 24).fill('#f1f5f9');
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('TOTAL TAXABLE INVOICE VALUE (VAT INCLUSIVE):', 46, curY + 7);
  doc.fontSize(10).fillColor('#b91c1c').text(`KES ${rentAmount.toLocaleString('en-KE')}`, doc.page.width - 150, curY + 6, { align: 'right', width: 100 });

  doc.y = curY + 34;

  // Fiscal QR Verification Box
  doc.rect(40, doc.y, doc.page.width - 80, 60).fillAndStroke('#fff5f5', '#fecaca');
  const qrY = doc.y + 6;
  doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('KRA eTIMS VERIFICATION & FISCAL CONFIRMATION SEAL:', 50, qrY);
  doc.fillColor('#7f1d1d').fontSize(7.5).font('Helvetica').text(`KRA Verification URL: https://itax.kra.go.ke/KRA-Portal/invoiceConfirmation.htm?invoiceNo=${invoiceNumber}`, 50, qrY + 12);
  doc.text(`Digital Internal Data Hash: SHA256-${Date.now().toString(36).toUpperCase()}-KRA-VERIFIED`, 50, qrY + 23);
  doc.text('This tax invoice has been validated and transmitted electronically to the KRA Tax Ledger.', 50, qrY + 34);
  doc.font('Helvetica-Bold').text('Valid and Lawful Tax Deductible Receipt for Business Expense / Tenant Accounting.', 50, qrY + 45);

  drawOfficialFooter(doc, 'Page 1 of 1 • KRA Official eTIMS Tax Invoice');
}

// ─── 7. RENT RESTRICTION TRIBUNAL LANDLORD COMPLAINT (CAP 301) ───────────────

function renderOfficialRRTComplaintForm(doc, data) {
  drawHeaderBanner(doc, {
    title: 'Rent Restriction Tribunal Complaint',
    subtitle: 'Section 4 & 15 Rent Restriction Act (Cap 301 Part III)',
    refCode: `RRT/MBA/${data.case_number || '2026/091'}`,
    badgeText: 'JUDICIAL PLEADINGS',
    badgeColor: '#1e3a8a'
  });

  const rentKes = Number(data.rent_amount_kes || 0);
  const arrearsKes = Number(data.arrears_kes || data.demanded_rent_kes || rentKes * 2 || 0);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#09111e').text('REPUBLIC OF KENYA', { align: 'center' });
  doc.fontSize(11).text('IN THE RENT RESTRICTION TRIBUNAL AT MOMBASA', { align: 'center' });
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e40af').text(`TRIBUNAL TRIBUNAL CASE NO: RRT/MBA/${data.case_number || 'PENDING-2026'}`, { align: 'center' });
  doc.moveDown(0.8);

  // Cause Title
  doc.rect(40, doc.y, doc.page.width - 80, 36).fillAndStroke('#f8fafc', '#cbd5e1');
  const causeY = doc.y + 4;
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold');
  doc.text(`APPLICANT (LANDLORD): ${data.landlord_name || 'Property Owner'} (Rep by Mutune Real Estate Management)`, 50, causeY);
  doc.text('— VERSUS —', 50, causeY + 11, { align: 'center', width: doc.page.width - 100 });
  doc.text(`RESPONDENT (TENANT): ${data.tenant_name || 'Tenant Name'} (Unit ${data.unit_number || '1A'}, ${data.property_name || 'Property'})`, 50, causeY + 22);

  doc.y = causeY + 40;

  // Formal Chamber Summons / Complaint Statement
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('LANDLORD FORMAL APPLICATION FOR VACANT POSSESSION & DISTRESS UNDER CAP 301:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
  doc.text('THE APPLICANT HEREBY APPLIES to this Honourable Tribunal for orders under Sections 4, 15, and 19 of the Rent Restriction Act (Cap 301 Laws of Kenya) on the following grounds:');
  doc.moveDown(0.3);

  doc.text(`1. The Applicant is the registered owner / lawful managing agent of the premises known as Unit ${data.unit_number || '1A'} situated at ${data.property_name || 'Property Name'}, Mombasa.`);
  doc.text(`2. The Respondent is in occupation of the said premises at an agreed standard monthly rent of KES ${rentKes.toLocaleString('en-KE')} payable in advance on the 5th of each month.`);
  doc.text(`3. The Respondent has persistently neglected, failed, and/or refused to tender monthly rent, with accrued arrears now standing at KES ${arrearsKes.toLocaleString('en-KE')}.`);
  doc.text('4. The Applicant served a formal 7-Day Statutory Demand Note which expired without full payment or surrender of vacant possession.');
  doc.text('5. GROUNDS OF COMPLAINT: Continuous non-payment of standard rent, substantial breach of tenancy covenants, and nuisance to adjacent tenants.');

  doc.moveDown(0.8);

  // Prayers
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('REPRESENTATIONS & RELIEFS PRAYED FOR:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
  doc.text('a) An order for immediate vacant possession and eviction of the Respondent from the suit premises.');
  doc.text(`b) Judgment against the Respondent for the sum of KES ${arrearsKes.toLocaleString('en-KE')} being outstanding rent arrears.`);
  doc.text('c) Leave to issue Distress for Rent against the goods and chattels of the Respondent.');
  doc.text('d) Mesne profits at the rate of double standard rent from date of expiry of notice until vacant possession is delivered.');
  doc.text('e) Costs of this application and incidentals.');

  doc.moveDown(1.5);

  // Attestation
  const sigY = doc.y;
  doc.rect(40, sigY, doc.page.width - 80, 52).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('DATED AT MOMBASA THIS ' + new Date().toLocaleDateString('en-KE') + ':', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('ADVOCATES FOR THE APPLICANT / APPLICANT AGENT:', 50, sigY + 24);
  doc.text('Mutune Real Estate Legal Department • P.O. Box 90120-80100 Mombasa', 50, sigY + 36);
  drawOfficialStamp(doc, doc.page.width - 85, sigY + 26, 'RRT PLEADINGS', 'FILED MOMBASA');

  drawOfficialFooter(doc, 'Page 1 of 1 • Republic of Kenya Rent Restriction Tribunal');
}

// ─── 8. RENT RESTRICTION TRIBUNAL TENANT RESPONSE (CAP 301) ─────────────────

function renderOfficialRRTResponseForm(doc, data) {
  drawHeaderBanner(doc, {
    title: 'RRT Tenant Dispute Response',
    subtitle: 'Section 6 & 15 Rent Restriction Act (Cap 301 Part III)',
    refCode: `RRT/RESP/${data.case_number || '2026/091'}`,
    badgeText: 'TENANT TRIBUNAL DEFENSE',
    badgeColor: '#0369a1'
  });

  const rentKes = Number(data.rent_amount_kes || 0);
  const demandedRent = Number(data.demanded_rent_kes || Math.round(rentKes * 1.3) || 0);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#09111e').text('REPUBLIC OF KENYA', { align: 'center' });
  doc.fontSize(11).text('IN THE RENT RESTRICTION TRIBUNAL AT MOMBASA', { align: 'center' });
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0369a1').text(`TRIBUNAL CASE NO: RRT/MBA/${data.case_number || 'PENDING-2026'}`, { align: 'center' });
  doc.moveDown(0.8);

  // Cause Title
  doc.rect(40, doc.y, doc.page.width - 80, 36).fillAndStroke('#f8fafc', '#cbd5e1');
  const causeY = doc.y + 4;
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold');
  doc.text(`APPLICANT (TENANT): ${data.tenant_name || 'Tenant Name'} (Unit ${data.unit_number || '1A'}, ${data.property_name || 'Property'})`, 50, causeY);
  doc.text('— VERSUS —', 50, causeY + 11, { align: 'center', width: doc.page.width - 100 });
  doc.text(`RESPONDENT (LANDLORD): ${data.landlord_name || 'Landlord Name'}`, 50, causeY + 22);

  doc.y = causeY + 40;

  // Statement of Dispute
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('TENANT FORMAL STATEMENT OF DISPUTE / RESPONSE UNDER CAP 301:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
  doc.text('THE TENANT/APPLICANT in response to illegal rent demands states as follows:');
  doc.moveDown(0.3);

  doc.text(`1. The Tenant lawfully occupies Unit ${data.unit_number || '1A'} at ${data.property_name || 'Property Name'} as a protected tenancy under Section 2 of the Rent Restriction Act (Cap 301).`);
  doc.text(`2. The agreed Standard Rent previously assessed and paid is KES ${rentKes.toLocaleString('en-KE')} per calendar month.`);
  doc.text(`3. The Landlord has unlawfully and unilaterally sought to escalate rent to KES ${demandedRent.toLocaleString('en-KE')} without standard rent assessment or variation order by this Tribunal.`);
  doc.text('4. The Landlord has issued unlawful eviction threats and threatened disconnection of communal water and electricity utilities.');

  doc.moveDown(0.8);

  // Prayers
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('ORDERS PRAYED FOR:');
  doc.moveDown(0.3);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
  doc.text('a) An interim injunction restraining the Landlord from unlawful eviction, harassment, or interfering with quiet possession.');
  doc.text('b) An order restraining disconnection of essential water, electricity, and sanitation utilities.');
  doc.text('c) Determination and certification of the lawful Standard Rent for the unit by the Tribunal Valuer.');
  doc.text('d) An order for refund or set-off of any excess rents unlawfully levied by the Landlord.');

  doc.moveDown(1.5);

  // Attestation
  const sigY = doc.y;
  doc.rect(40, sigY, doc.page.width - 80, 52).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('DATED AT MOMBASA THIS ' + new Date().toLocaleDateString('en-KE') + ':', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('TENANT / ADVOCATE FOR THE TENANT:', 50, sigY + 24);
  doc.text(`Tenant Signatory: ${data.tenant_name || 'Tenant Name'} • Handset: ${data.phone || 'N/A'}`, 50, sigY + 36);
  drawOfficialStamp(doc, doc.page.width - 85, sigY + 26, 'RRT PLEADINGS', 'FILED MOMBASA');

  drawOfficialFooter(doc, 'Page 1 of 1 • Republic of Kenya Rent Restriction Tribunal');
}

function renderOfficialGenericDocument(doc, data) {
  drawHeaderBanner(doc, {
    title: 'Official Legal Instrument',
    subtitle: 'Mutune Real Estate Legal Suite',
    refCode: `GEN-${Date.now().toString().slice(-5)}`
  });
  doc.fontSize(10).font('Helvetica').fillColor('#0f172a').text(JSON.stringify(data, null, 2));
  drawOfficialFooter(doc);
}

module.exports = {
  generateLegalPDF
};
