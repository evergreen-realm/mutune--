const PDFDocument = require('pdfkit');
const { uploadImage } = require('../utils/r2');
const logger = require('../utils/logger');

class PDFService {
  constructor() {
    this.companyName = 'Mutune Estate Agency';
    this.companyAddress = 'Mombasa, Kenya';
    this.companyPhone = '+254 700 000 000';
  }

  async generateNoticePDF({ notice, tenant, property, unit }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);
            const key = `${process.env.NOTICE_PDF_PREFIX || 'notices/'}${notice._id}_${Date.now()}.pdf`;
            const upload = await uploadImage(pdfBuffer, key, 'application/pdf');
            if (upload.success) {
              resolve(upload.url);
            } else {
              if (process.env.NODE_ENV === 'test' || !process.env.CLOUDFLARE_R2_BUCKET) {
                resolve(`https://r2.cloudflare.com/mock-${key}`);
              } else {
                reject(new Error('PDF upload to R2 failed'));
              }
            }
          } catch (uploadErr) {
            logger.error('PDF upload error', { error: uploadErr.message });
            reject(uploadErr);
          }
        });

        doc.on('error', (err) => {
          logger.error('PDFDocument stream error', { error: err.message });
          reject(err);
        });

        // ── Header ───────────────────────────────────────────────────────────
        doc.fontSize(20).fillColor('#111827').text(this.companyName, 50, 50);
        doc.fontSize(10).fillColor('#6b7280').text(this.companyAddress, 50, 75);
        doc.text(this.companyPhone, 50, 90);
        doc.moveDown(2);

        // ── Notice Type Banner ────────────────────────────────────────────────
        const typeLabels = {
          rent_increase: 'RENT INCREASE NOTICE',
          maintenance: 'MAINTENANCE NOTICE',
          eviction: 'EVICTION NOTICE',
          lease_renewal: 'LEASE RENEWAL NOTICE',
          entry_inspection: 'ENTRY INSPECTION NOTICE',
          general: 'GENERAL NOTICE'
        };

        const bannerY = doc.y;
        doc.rect(50, bannerY, 500, 30).fill('#dc2626');
        doc.fillColor('#ffffff')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(typeLabels[notice.notice_type] || 'OFFICIAL NOTICE', 60, bannerY + 9, { width: 480 });
        doc.moveDown(2.5);

        // ── Meta ──────────────────────────────────────────────────────────────
        doc.fillColor('#111827').font('Helvetica').fontSize(10);
        doc.text(`Date Issued: ${new Date(notice.created_at).toLocaleDateString('en-KE')}`);
        doc.text(`Effective Date: ${new Date(notice.effective_date).toLocaleDateString('en-KE')}`);
        doc.text(`Notice ID: ${notice._id}`);
        doc.text(`Property: ${property?.name || 'N/A'} (${property?.property_code || 'N/A'})`);
        doc.text(`Unit: ${unit?.unit_number || 'N/A'}`);
        doc.moveDown(1);

        // ── Tenant Info ───────────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(12).text('TO:', 50, doc.y, { underline: true });
        doc.font('Helvetica').fontSize(10);
        doc.text(`Name: ${tenant?.full_name || 'Tenant'}`);
        doc.text(`Phone: ${tenant?.phone || 'N/A'}`);
        doc.text(`ID Number: ${tenant?.id_number || 'N/A'}`);
        doc.moveDown(1.5);

        // ── Title ─────────────────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(14).text(notice.title, { underline: true });
        doc.moveDown(0.5);

        // ── Body ──────────────────────────────────────────────────────────────
        doc.font('Helvetica').fontSize(11).text(notice.body, { align: 'left', lineGap: 4 });
        doc.moveDown(2);

        // ── Legal Basis ───────────────────────────────────────────────────────
        if (notice.legal_basis) {
          doc.font('Helvetica-Bold').fontSize(10).text('Legal Basis:', { underline: true });
          doc.font('Helvetica-Oblique').fontSize(10).text(notice.legal_basis);
          doc.moveDown(1);
        }

        // ── Signature Line ────────────────────────────────────────────────────
        const sigY = Math.max(doc.y + 20, 620);
        doc.moveTo(50, sigY).lineTo(230, sigY).strokeColor('#374151').stroke();
        doc.font('Helvetica').fontSize(9).fillColor('#374151').text('Authorised Signature / Agent', 50, sigY + 5);
        doc.moveTo(310, sigY).lineTo(545, sigY).strokeColor('#374151').stroke();
        doc.text('Date', 310, sigY + 5);

        // ── Footer ────────────────────────────────────────────────────────────
        doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(
          'This notice was generated digitally by MutuneRent Pro. For disputes, contact the Estate Agents Registration Board (EARB) or the Rent Tribunal.',
          50, 740,
          { align: 'center', width: 500 }
        );

        doc.end();
      } catch (error) {
        logger.error('PDF generation failed', { error: error.message });
        reject(error);
      }
    });
  }

  async generateLandlordContractPDF({ property, landlord }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);
            const key = `contracts/agency_contract_${property._id}_${Date.now()}.pdf`;
            const upload = await uploadImage(pdfBuffer, key, 'application/pdf');
            if (upload.success) {
              resolve(upload.url);
            } else {
              if (process.env.NODE_ENV === 'test' || !process.env.CLOUDFLARE_R2_BUCKET) {
                resolve(`https://r2.cloudflare.com/mock-${key}`);
              } else {
                reject(new Error('Contract PDF upload to R2 failed'));
              }
            }
          } catch (uploadErr) {
            logger.error('Contract PDF upload error', { error: uploadErr.message });
            reject(uploadErr);
          }
        });

        doc.on('error', (err) => {
          logger.error('PDFDocument stream error', { error: err.message });
          reject(err);
        });

        // Header
        doc.fontSize(20).fillColor('#2563eb').font('Helvetica-Bold').text(this.companyName, 50, 50);
        doc.fontSize(10).fillColor('#6b7280').font('Helvetica').text(this.companyAddress, 50, 75);
        doc.text(this.companyPhone, 50, 90);
        doc.moveDown(2);

        // Title
        doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('STANDARD REAL ESTATE AGENCY AGREEMENT', { align: 'center' });
        doc.moveDown(1.5);

        // Body
        doc.fontSize(11).font('Helvetica').fillColor('#374151');
        doc.text(`This Exclusive Real Estate Agency Agreement ("Agreement") is made on ${new Date().toLocaleDateString('en-KE')} between:`);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text(`1. THE AGENT: ${this.companyName}, operating from Mombasa, Kenya.`);
        doc.font('Helvetica-Bold').text(`2. THE LANDLORD: ${landlord.full_name}, residing at ${landlord.email || 'N/A'}, Phone: ${landlord.phone || 'N/A'}.`);
        doc.moveDown(1);
        doc.font('Helvetica').text(`WHEREAS, the Landlord owns the property described below and desires to engage the Agent to perform leasing, property management, rent collection, and maintenance management services:`);
        doc.moveDown(1);
        doc.font('Helvetica-Bold').text(`PROPERTY DESCRIPTION:`);
        doc.font('Helvetica').text(`Name: ${property.name}`);
        doc.text(`Property Code: ${property.property_code}`);
        doc.text(`Address: ${property.address?.street || ''}, ${property.address?.area || ''}, ${property.address?.city || ''}`);
        doc.text(`Total Units submitted: ${property.units?.length || 0}`);
        doc.moveDown(1.5);

        doc.font('Helvetica-Bold').text(`COMMISSION AND TERMS:`);
        doc.font('Helvetica').text(`- Management Commission: 10% of monthly gross rents collected.`);
        doc.text(`- Term: This agreement shall remain in effect for one (1) year from the date of execution.`);
        doc.text(`- Termination: Either party may terminate with 60 days written notice.`);
        doc.moveDown(2);

        // Signatures
        const sigY = Math.max(doc.y + 30, 620);
        doc.moveTo(50, sigY).lineTo(230, sigY).strokeColor('#374151').stroke();
        doc.font('Helvetica').fontSize(9).fillColor('#374151').text('Authorised Signature / Mutune Agent', 50, sigY + 5);

        doc.moveTo(310, sigY).lineTo(545, sigY).strokeColor('#374151').stroke();
        doc.text('Landlord / Representative Signature', 310, sigY + 5);

        // Footer
        doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(
          'This agreement was digitally generated by MutuneRent Pro. The digital signature or submission confirmation serves as proof of execution.',
          50, 740,
          { align: 'center', width: 500 }
        );

        doc.end();
      } catch (error) {
        logger.error('Contract PDF generation failed', { error: error.message });
        reject(error);
      }
    });
  }
}

module.exports = new PDFService();
