const fs = require('fs');
const docusign = require('docusign-esign');

let _cachedToken = null;
let _tokenExpiry = 0;

async function getApiClient() {
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(process.env.DOCUSIGN_BASE_URL || 'https://na4.docusign.net/restapi');
  apiClient.setOAuthBasePath('account.docusign.com');

  if (_cachedToken && Date.now() < _tokenExpiry) {
    apiClient.addDefaultHeader('Authorization', `Bearer ${_cachedToken}`);
    return apiClient;
  }

  const privateKey = fs.readFileSync(process.env.DOCUSIGN_PRIVATE_KEY_PATH);
  const results = await apiClient.requestJWTUserToken(
    process.env.DOCUSIGN_INTEGRATION_KEY,
    process.env.DOCUSIGN_USER_ID,
    ['signature', 'impersonation'],
    privateKey,
    3600
  );

  _cachedToken = results.body.access_token;
  _tokenExpiry = Date.now() + (results.body.expires_in - 60) * 1000;
  apiClient.addDefaultHeader('Authorization', `Bearer ${_cachedToken}`);
  return apiClient;
}

async function sendRenewal({ tenant, lease, newEndDate, newRentAmount }) {
  const apiClient = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const tenantName = `${tenant.firstName} ${tenant.lastName}`;
  const leaseHtml = buildRenewalDocument({ tenant, lease, newEndDate, newRentAmount });

  const envelope = {
    emailSubject: 'Action Required: Lease Renewal Agreement',
    emailBlurb: `Hi ${tenant.firstName}, your lease renewal is ready to sign. Please review and sign at your earliest convenience.`,
    documents: [
      {
        documentBase64: Buffer.from(leaseHtml).toString('base64'),
        name: 'Lease Renewal Agreement',
        fileExtension: 'html',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: tenant.email,
          name: tenantName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                anchorString: '[[TENANT_SIGNATURE]]',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorUnits: 'pixels',
              },
            ],
            dateSignedTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                anchorString: '[[DATE_SIGNED]]',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorUnits: 'pixels',
              },
            ],
            fullNameTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                anchorString: '[[TENANT_NAME]]',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorUnits: 'pixels',
              },
            ],
          },
        },
      ],
    },
    status: 'sent',
  };

  const result = await envelopesApi.createEnvelope(
    process.env.DOCUSIGN_ACCOUNT_ID,
    { envelopeDefinition: envelope }
  );

  return result.envelopeId;
}

async function getEnvelopeStatus(envelopeId) {
  const apiClient = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const result = await envelopesApi.getEnvelope(process.env.DOCUSIGN_ACCOUNT_ID, envelopeId);
  return result.status;
}

async function downloadSignedDocument(envelopeId) {
  const apiClient = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const docBytes = await envelopesApi.getDocument(
    process.env.DOCUSIGN_ACCOUNT_ID,
    envelopeId,
    'combined'
  );
  return docBytes;
}

function buildRenewalDocument({ tenant, lease, newEndDate, newRentAmount }) {
  const startDateStr = new Date(lease.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDateStr = new Date(newEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const amount = (newRentAmount || lease.rentAmount).toFixed(2);
  const propertyAddress = lease.unit?.property?.address || '';
  const unitNumber = lease.unit?.unitNumber || '';
  const tenantName = `${tenant.firstName} ${tenant.lastName}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>
  body { font-family: Arial, sans-serif; max-width: 720px; margin: 60px auto; color: #111; line-height: 1.6; font-size: 14px; }
  h1 { font-size: 22px; border-bottom: 2px solid #000; padding-bottom: 12px; }
  h2 { font-size: 16px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 12px; border: 1px solid #ccc; }
  td:first-child { font-weight: bold; width: 40%; background: #f5f5f5; }
  .sig-block { margin-top: 60px; }
  .sig-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 4px; }
  .sig-label { font-size: 11px; color: #555; }
  .anchor { font-size: 8px; color: white; }
</style></head>
<body>

<h1>Lease Renewal Agreement</h1>

<p>This Lease Renewal Agreement is entered into between the Property Owner/Manager ("Landlord") and the following Tenant, and amends the original lease agreement as described herein.</p>

<h2>Parties & Property</h2>
<table>
  <tr><td>Tenant Name</td><td>${tenantName}</td></tr>
  <tr><td>Tenant Email</td><td>${tenant.email}</td></tr>
  <tr><td>Property Address</td><td>${propertyAddress}</td></tr>
  <tr><td>Unit</td><td>${unitNumber}</td></tr>
</table>

<h2>Renewal Terms</h2>
<table>
  <tr><td>Original Lease Start</td><td>${startDateStr}</td></tr>
  <tr><td>New Lease End Date</td><td>${endDateStr}</td></tr>
  <tr><td>Monthly Rent</td><td>$${amount}</td></tr>
  <tr><td>Payment Due Date</td><td>1st of each month</td></tr>
</table>

<h2>Terms & Conditions</h2>
<p>All terms, conditions, covenants, and obligations of the original lease agreement between the parties remain in full force and effect throughout the renewal period, except as expressly modified herein. Tenant acknowledges receipt and review of this renewal agreement.</p>

<p>By signing below, Tenant agrees to renew the lease under the terms stated above.</p>

<div class="sig-block">
  <p><strong>Tenant Signature:</strong></p>
  <div class="sig-line"></div>
  <span class="anchor">[[TENANT_SIGNATURE]]</span>
  <div class="sig-label">Tenant Signature</div>

  <br/>
  <p><strong>Tenant Printed Name:</strong></p>
  <div class="sig-line"></div>
  <span class="anchor">[[TENANT_NAME]]</span>
  <div class="sig-label">Printed Name</div>

  <br/>
  <p><strong>Date Signed:</strong></p>
  <div class="sig-line"></div>
  <span class="anchor">[[DATE_SIGNED]]</span>
  <div class="sig-label">Date</div>
</div>

</body>
</html>`;
}

module.exports = { sendRenewal, getEnvelopeStatus, downloadSignedDocument };
