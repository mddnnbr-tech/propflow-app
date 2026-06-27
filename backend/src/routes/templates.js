const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// System templates seeded on first request if none exist
const SYSTEM_TEMPLATES = [
  {
    name: 'Standard 12-Month Lease',
    category: 'lease',
    description: 'Full residential lease agreement for a fixed 12-month term.',
    isSystem: true,
    content: `RESIDENTIAL LEASE AGREEMENT

This Lease Agreement ("Agreement") is entered into as of {{LEASE_DATE}} between {{LANDLORD_NAME}} ("Landlord") and {{TENANT_NAME}} ("Tenant").

1. PROPERTY
   Landlord hereby leases to Tenant the property located at {{PROPERTY_ADDRESS}}, Unit {{UNIT_NUMBER}} (the "Premises").

2. TERM
   The lease term begins on {{START_DATE}} and ends on {{END_DATE}}.

3. RENT
   Tenant agrees to pay \${{RENT_AMOUNT}} per month, due on the 1st of each month.
   Rent shall be paid to: {{PAYMENT_ADDRESS}}

4. LATE FEES
   If rent is not received within {{LATE_FEE_GRACE_DAYS}} days of the due date, a late fee of \${{LATE_FEE}} will be assessed.

5. SECURITY DEPOSIT
   A security deposit of \${{DEPOSIT_AMOUNT}} is due upon signing. The deposit will be returned within 30 days of move-out, less any deductions for damages beyond normal wear and tear.

6. UTILITIES
   {{UTILITIES_INCLUDED}}

7. MAINTENANCE
   Tenant shall keep the Premises in clean and sanitary condition. Tenant shall promptly notify Landlord of any needed repairs. Tenant is responsible for minor maintenance (light bulbs, batteries, etc.).

8. PETS
   {{PET_POLICY}}

9. ALTERATIONS
   Tenant shall make no alterations, additions, or improvements to the Premises without prior written consent of the Landlord.

10. ENTRY BY LANDLORD
    Landlord may enter the Premises upon 24-hour notice for inspection, repairs, or showing. In emergencies, no notice is required.

11. PROHIBITED ACTIVITIES
    Tenant shall not use the Premises for any unlawful purpose, disturb neighbors, or engage in any activity that increases Landlord's insurance risk.

12. TERMINATION
    Either party may terminate this lease at the end of the term by providing 30 days written notice. Early termination by Tenant may result in forfeiture of the security deposit and liability for remaining rent.

13. RENEWAL
    This lease {{AUTO_RENEW_CLAUSE}}.

14. GOVERNING LAW
    This Agreement shall be governed by the laws of {{STATE}}.

LANDLORD: _______________________  Date: ___________

TENANT: ________________________  Date: ___________
`,
  },
  {
    name: 'Month-to-Month Lease',
    category: 'lease',
    description: 'Flexible month-to-month residential lease. Either party can terminate with 30 days notice.',
    isSystem: true,
    content: `MONTH-TO-MONTH RENTAL AGREEMENT

This Month-to-Month Rental Agreement is entered into as of {{LEASE_DATE}} between {{LANDLORD_NAME}} ("Landlord") and {{TENANT_NAME}} ("Tenant").

1. PROPERTY
   {{PROPERTY_ADDRESS}}, Unit {{UNIT_NUMBER}}

2. TERM
   This agreement begins {{START_DATE}} and continues on a month-to-month basis until terminated.

3. TERMINATION
   Either party may terminate this agreement by providing 30 days written notice to the other party.

4. RENT
   Monthly rent: \${{RENT_AMOUNT}}, due on the 1st of each month.

5. LATE FEES
   Late fee of \${{LATE_FEE}} applies if rent is not received by the {{LATE_FEE_GRACE_DAYS}}th of the month.

6. SECURITY DEPOSIT
   \${{DEPOSIT_AMOUNT}}, returned within 21 days of move-out.

7. RENT CHANGES
   Landlord may adjust rent with 30 days written notice.

8. PETS
   {{PET_POLICY}}

9. UTILITIES
   {{UTILITIES_INCLUDED}}

10. GENERAL CONDITIONS
    All standard lease conditions apply including maintenance responsibilities, no alterations without consent, no illegal activity, and 24-hour entry notice.

LANDLORD: _______________________  Date: ___________

TENANT: ________________________  Date: ___________
`,
  },
  {
    name: 'Lease Renewal Addendum',
    category: 'renewal',
    description: 'Simple one-page addendum to renew an existing lease at new terms.',
    isSystem: true,
    content: `LEASE RENEWAL ADDENDUM

This Addendum amends the Lease Agreement dated {{ORIGINAL_LEASE_DATE}} between {{LANDLORD_NAME}} ("Landlord") and {{TENANT_NAME}} ("Tenant") for the property at {{PROPERTY_ADDRESS}}, Unit {{UNIT_NUMBER}}.

RENEWAL TERMS:
  New Lease End Date:  {{NEW_END_DATE}}
  Monthly Rent:        \${{NEW_RENT_AMOUNT}}

All other terms and conditions of the original Lease Agreement remain unchanged and in full force and effect.

By signing below, both parties agree to renew the lease under the terms stated above.

LANDLORD: _______________________  Date: ___________

TENANT: ________________________  Date: ___________
`,
  },
  {
    name: 'Pet Addendum',
    category: 'addendum',
    description: 'Adds pet permission and pet deposit terms to an existing lease.',
    isSystem: true,
    content: `PET ADDENDUM TO LEASE AGREEMENT

This Pet Addendum is incorporated into the Lease Agreement between {{LANDLORD_NAME}} and {{TENANT_NAME}} for {{PROPERTY_ADDRESS}}, Unit {{UNIT_NUMBER}}.

PERMITTED PET(S):
  Type / Breed: {{PET_TYPE}}
  Name:         {{PET_NAME}}
  Weight:       {{PET_WEIGHT}} lbs

PET DEPOSIT: \${{PET_DEPOSIT}} (non-refundable / refundable — see below)
  [ ] Non-refundable pet fee
  [ ] Refundable pet deposit, returned at move-out subject to pet damage inspection

TENANT RESPONSIBILITIES:
  1. Keep pet vaccinated and licensed per local ordinances.
  2. Clean up all pet waste immediately.
  3. Prevent pet from causing noise disturbances.
  4. Any pet damage beyond normal wear is Tenant's financial responsibility.
  5. Pet must be kept on leash in all common areas.

Landlord may revoke this permission with 30-day notice if pet causes damage or disturbances.

LANDLORD: _______________________  Date: ___________

TENANT: ________________________  Date: ___________
`,
  },
  {
    name: 'Move-In / Move-Out Inspection Checklist',
    category: 'inspection',
    description: 'Room-by-room condition checklist to document unit state at move-in and move-out.',
    isSystem: true,
    content: `MOVE-IN / MOVE-OUT INSPECTION CHECKLIST

Property: {{PROPERTY_ADDRESS}}, Unit {{UNIT_NUMBER}}
Tenant: {{TENANT_NAME}}
Move-In Date: {{START_DATE}}
Move-Out Date: _______________

CONDITION KEY: E = Excellent  G = Good  F = Fair  P = Poor  N/A = Not Applicable

LIVING ROOM                    Move-In    Move-Out   Notes
  Walls / Ceiling              _______    _______    _______________
  Floors / Carpet              _______    _______    _______________
  Windows / Blinds             _______    _______    _______________
  Doors / Locks                _______    _______    _______________
  Light Fixtures               _______    _______    _______________

KITCHEN
  Walls / Ceiling              _______    _______    _______________
  Floors                       _______    _______    _______________
  Cabinets / Drawers           _______    _______    _______________
  Countertops                  _______    _______    _______________
  Refrigerator                 _______    _______    _______________
  Stove / Oven                 _______    _______    _______________
  Dishwasher                   _______    _______    _______________
  Sink / Faucet                _______    _______    _______________

BATHROOM(S)
  Walls / Ceiling              _______    _______    _______________
  Floors / Tiles               _______    _______    _______________
  Toilet                       _______    _______    _______________
  Sink / Vanity                _______    _______    _______________
  Shower / Tub                 _______    _______    _______________

BEDROOM(S)
  Walls / Ceiling              _______    _______    _______________
  Floors / Carpet              _______    _______    _______________
  Closets                      _______    _______    _______________
  Windows / Blinds             _______    _______    _______________

GENERAL
  Smoke Detectors (tested)     _______    _______    _______________
  CO Detectors (tested)        _______    _______    _______________
  HVAC Filter                  _______    _______    _______________
  Keys Provided: _____ sets

Tenant confirms unit is in the condition described above at move-in.

LANDLORD: _______________________  Date: ___________

TENANT: ________________________  Date: ___________
`,
  },
  {
    name: 'Vendor Service Agreement',
    category: 'vendor',
    description: 'Standard service agreement for preferred maintenance vendors.',
    isSystem: true,
    content: `VENDOR SERVICE AGREEMENT

This Service Agreement is entered into between {{LANDLORD_NAME}} / {{COMPANY_NAME}} ("Property Manager") and {{VENDOR_NAME}} ("Vendor").

SERVICES:
  Trade / Specialty: {{VENDOR_TRADE}}
  Service Area:      {{SERVICE_AREA}}
  License #:         {{LICENSE_NUMBER}}

TERMS:
  1. Vendor shall respond to dispatched service requests within {{RESPONSE_TIME}} hours.
  2. Vendor shall provide written estimates before beginning any work exceeding \${{ESTIMATE_THRESHOLD}}.
  3. Vendor shall maintain general liability insurance of at least $1,000,000 per occurrence.
  4. Vendor shall maintain all required trade licenses in current standing.
  5. All work shall comply with local building codes and manufacturer specifications.
  6. Vendor shall not subcontract work without prior written approval.
  7. Payment terms: Net {{PAYMENT_TERMS}} days from invoice approval.

RATES:
  Standard Rate:     \${{HOURLY_RATE}}/hr
  Emergency Rate:    \${{EMERGENCY_RATE}}/hr (after hours / weekends)
  Trip Charge:       \${{TRIP_CHARGE}} (if applicable)

This agreement is valid from {{START_DATE}} and may be terminated by either party with 30 days written notice.

PROPERTY MANAGER: _______________  Date: ___________

VENDOR: ________________________  Date: ___________
`,
  },
];

async function seedSystemTemplates() {
  const existing = await prisma.leaseTemplate.count({ where: { isSystem: true } });
  if (existing === 0) {
    await prisma.leaseTemplate.createMany({
      data: SYSTEM_TEMPLATES.map((t) => ({ ...t, managerId: null })),
    });
  }
}

// GET /api/templates — system templates + manager's own
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  await seedSystemTemplates();
  const templates = await prisma.leaseTemplate.findMany({
    where: {
      OR: [{ isSystem: true }, { managerId: req.user.id }],
    },
    orderBy: [{ isSystem: 'desc' }, { category: 'asc' }, { name: 'asc' }],
  });
  res.json(templates);
});

// GET /api/templates/:id — full content for a single template
router.get('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const template = await prisma.leaseTemplate.findFirst({
    where: {
      id: req.params.id,
      OR: [{ isSystem: true }, { managerId: req.user.id }],
    },
  });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

// POST /api/templates — manager creates a custom template
router.post('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { name, description, category, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
  const template = await prisma.leaseTemplate.create({
    data: { managerId: req.user.id, name, description, category: category || 'lease', content, isSystem: false },
  });
  res.status(201).json(template);
});

// PUT /api/templates/:id — update a custom template (not system ones)
router.put('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const template = await prisma.leaseTemplate.findFirst({
    where: { id: req.params.id, managerId: req.user.id, isSystem: false },
  });
  if (!template) return res.status(404).json({ error: 'Template not found or not editable' });

  const { name, description, category, content } = req.body;
  const updated = await prisma.leaseTemplate.update({
    where: { id: req.params.id },
    data: { name, description, category, content },
  });
  res.json(updated);
});

// DELETE /api/templates/:id — delete a custom template
router.delete('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const template = await prisma.leaseTemplate.findFirst({
    where: { id: req.params.id, managerId: req.user.id, isSystem: false },
  });
  if (!template) return res.status(404).json({ error: 'Template not found or not deletable' });
  await prisma.leaseTemplate.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

module.exports = router;
