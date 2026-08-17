const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MutuneRent Pro API Documentation',
      version: '1.0.0',
      description: 'Comprehensive REST API documentation for MutuneRent Pro — modern Kenyan PropTech property management, automated rent collections, KRA eTIMS tax compliance, utility vending, and digital lease e-signing.',
      contact: {
        name: 'Mutune Estate Agency Technical Support',
        email: 'meshachmaluki@gmail.com'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current API Gateway'
      }
    ],
    tags: [
      { name: 'Properties', description: 'Property CRUD and unit management' },
      { name: 'Payments', description: 'M-Pesa STK Push, C2B, and bank payments' },
      { name: 'Tenants', description: 'Tenant lifecycle and occupancy management' },
      { name: 'Maintenance', description: 'Maintenance ticket workflow and repairs' },
      { name: 'Utilities', description: 'KPLC electricity and water billing via Kyanda' },
      { name: 'Tax', description: 'KRA eTIMS compliance and WHT reporting' },
      { name: 'Notices', description: 'Legal notice generation and delivery' },
      { name: 'Admin', description: 'System administration and user oversight' },
      { name: 'AI', description: 'AI assistant for Kenyan tenancy operations' },
      { name: 'Listings', description: 'Public property marketplace and inquiries' },
      { name: 'Tasks', description: 'Agent and caretaker task tracking' },
      { name: 'Inventory', description: 'Property assets and auctioning' },
      { name: 'Notifications', description: 'In-app and push notification management' },
      { name: 'Upload', description: 'Document and media asset storage' },
      { name: 'Scans', description: '3D spatial room capture and splats' },
      { name: 'Settings', description: 'Financial configuration and system settings' },
      { name: 'Commission', description: 'Agent salary and commission calculations' },
      { name: 'Disbursement', description: 'Landlord and vendor payout engine' },
      { name: 'Paperwork', description: 'Legal leases, tenancy agreements, and PDF suite' },
      { name: 'Vacation', description: 'Tenant vacation and move-out inspections' },
      { name: 'Exchange', description: 'CBK official exchange rate retrieval' },
      { name: 'Audit', description: 'Compliance audit log trail' },
      { name: 'Scoring', description: 'Tenant financial credit & behavioral scoring' },
      { name: 'Vendors', description: 'Service vendor registration and payouts' },
      { name: 'BankPayments', description: 'Multi-bank checkout and webhooks' },
      { name: 'USSD', description: 'Africa\'s Talking USSD self-service gateway' },
      { name: 'Users', description: 'User management, onboarding, and Clerk sync' },
      { name: 'Agents', description: 'Agent geo-checkin and performance' },
      { name: 'Reports', description: 'Financial statements and KRA reconciliation CSV' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk session JWT token'
        }
      },
      schemas: {
        StandardSuccess: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' }
          }
        },
        StandardError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid request payload' }
              }
            }
          }
        },
        Property: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '6a8220d5c296e2743e56a717' },
            name: { type: 'string', example: 'Nyali Luxury Heights' },
            property_code: { type: 'string', example: 'PROP-MOM-001' },
            property_type: { type: 'string', enum: ['residential', 'commercial'], example: 'residential' },
            landlord_id: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string', example: 'Links Road' },
                city: { type: 'string', example: 'Mombasa' },
                area: { type: 'string', example: 'Nyali' }
              }
            },
            units: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  unit_number: { type: 'string', example: 'A1' },
                  rent_kes: { type: 'number', example: 45000 },
                  status: { type: 'string', enum: ['occupied', 'vacant', 'maintenance'], example: 'occupied' },
                  listing_status: { type: 'string', enum: ['unlisted', 'listed', 'draft'], example: 'listed' }
                }
              }
            }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            transaction_id: { type: 'string', example: 'MUT-STK-98124' },
            amount_kes: { type: 'number', example: 45000 },
            channel: { type: 'string', enum: ['mpesa_stk', 'mpesa_c2b', 'bank_transfer', 'card'], example: 'mpesa_stk' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'failed', 'reversed'], example: 'confirmed' },
            mpesa_receipt: { type: 'string', example: 'QEH48XND72' }
          }
        },
        Tenant: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenant_code: { type: 'string', example: 'TNT-MOM-0001' },
            full_name: { type: 'string', example: 'Amina Mohamed' },
            phone: { type: 'string', example: '254712345678' },
            email: { type: 'string', example: 'amina@example.com' },
            id_number: { type: 'string', example: '12345678' },
            current_property_id: { type: 'string' },
            current_unit_id: { type: 'string' },
            rent_amount_kes: { type: 'number', example: 35000 },
            tenancy_status: { type: 'string', enum: ['pending', 'active', 'vacated', 'evicted'], example: 'active' }
          }
        },
        MaintenanceTicket: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            ticket_number: { type: 'string', example: 'TKT-2026-001' },
            title: { type: 'string', example: 'Plumbing leak in Master Bathroom' },
            category: { type: 'string', enum: ['plumbing', 'electrical', 'structural', 'appliance', 'general'], example: 'plumbing' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'emergency'], example: 'high' },
            status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'], example: 'open' }
          }
        },
        Notice: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'Rent Payment Due Notice' },
            notice_type: { type: 'string', enum: ['rent_due', 'late_payment', 'lease_renewal', 'vacate_notice', 'general'], example: 'rent_due' },
            status: { type: 'string', enum: ['draft', 'sent', 'acknowledged'], example: 'sent' }
          }
        },
        Task: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'Quarterly Move-in Inspection' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], example: 'pending' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], example: 'medium' }
          }
        },
        Vendor: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Coast Plumbing Services' },
            category: { type: 'string', example: 'Plumbing' },
            phone: { type: 'string', example: '254722000111' },
            is_active: { type: 'boolean', example: true }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            action: { type: 'string', example: 'PAYMENT_RECEIVED' },
            resource: { type: 'string', example: 'Payment:MUT-STK-98124' },
            user_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        AgentSalary: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            agent_id: { type: 'string' },
            month: { type: 'string', example: '2026-08' },
            base_salary_kes: { type: 'number', example: 40000 },
            commission_kes: { type: 'number', example: 15000 },
            net_payout_kes: { type: 'number', example: 55000 },
            status: { type: 'string', enum: ['pending', 'approved', 'paid'], example: 'paid' }
          }
        },
        UtilityMeter: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            property_id: { type: 'string' },
            unit_id: { type: 'string' },
            meter_type: { type: 'string', enum: ['electricity_prepaid', 'electricity_postpaid', 'water'], example: 'water' },
            provider: { type: 'string', example: 'MOMBASA_WATER' },
            token_number: { type: 'string', example: 'MW-0091823' }
          }
        },
        UtilityReading: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            property_id: { type: 'string' },
            tenant_id: { type: 'string' },
            billing_month: { type: 'string', example: '2026-08' },
            previous_reading: { type: 'number', example: 120.5 },
            current_reading: { type: 'number', example: 145.2 },
            consumption_units: { type: 'number', example: 24.7 },
            total_amount_kes: { type: 'number', example: 1235 }
          }
        },
        UtilityTokenResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: '4820-9182-4401-8392-1029' },
                units_kwh: { type: 'number', example: 21.4 },
                meter_number: { type: 'string', example: '14234567890' },
                amount_kes: { type: 'number', example: 500 }
              }
            }
          }
        },
        WaterBillResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                account_number: { type: 'string', example: 'MW-895500-1234' },
                provider_name: { type: 'string', example: 'Mombasa Water Supply & Sanitation Co (MEWASCO)' },
                customer_name: { type: 'string', example: 'Amina Mohamed' },
                balance_kes: { type: 'number', example: 1450 },
                due_date: { type: 'string', example: '2026-08-31' }
              }
            }
          }
        },
        WaterPaymentResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Water utility bill paid successfully ✓' },
            data: {
              type: 'object',
              properties: {
                account_number: { type: 'string', example: 'MW-895500-1234' },
                provider_name: { type: 'string', example: 'Mombasa Water Supply & Sanitation Co (MEWASCO)' },
                amount_kes: { type: 'number', example: 1450 },
                receipt_number: { type: 'string', example: 'WATER-PAY-1786991200' }
              }
            }
          }
        }
      }
    }
  },
  apis: [path.join(__dirname, '../routes/*.js')]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
