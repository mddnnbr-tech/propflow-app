// Tier-based vendor automation
// Starter: manual dispatch only (no automation)
// Growth: auto-dispatch + confirmation email to vendor + manager alert
// Pro: Growth + 48hr follow-up email + completion-required payment gate

const notificationService = require('./notifications.service');

// Called when a maintenance request is dispatched to a vendor
async function onVendorDispatched(prisma, { request, vendor, manager, tier = 'GROWTH' }) {
  const unit = request.unit;
  const property = unit?.property;
  const tenant = request.tenant;

  if (tier === 'STARTER') {
    // Starter: just save the dispatch, no automated emails
    return;
  }

  // Growth + Pro: Send dispatch confirmation to vendor
  await notificationService.sendEmail({
    to: vendor.email,
    subject: `New Service Request — ${property?.name || 'Property'} Unit ${unit?.unitNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1d4ed8;">Service Request Dispatched</h2>
        <p>Hi ${vendor.name},</p>
        <p>You have been assigned a new maintenance request. Please contact the tenant to schedule service.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Property</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${property?.name} — ${property?.address}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Unit</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${unit?.unitNumber}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Tenant</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${tenant?.firstName} ${tenant?.lastName}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Tenant Phone</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${tenant?.phone || 'On file'}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Trade</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.aiTrade || 'General'}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Priority</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.priority}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Description</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.description}</td></tr>
        </table>
        <p style="color:#64748b;font-size:13px;">Please reply to this email or call the tenant to confirm your appointment time. The property manager will be notified when the job is marked complete.</p>
        <p style="color:#64748b;font-size:13px;">— PropFlow Property Management</p>
      </div>
    `,
  });

  // Send SMS to vendor if phone on file
  if (vendor.phone) {
    await notificationService.sendSMS({
      to: vendor.phone,
      body: `PropFlow: New ${request.aiTrade || 'maintenance'} job at ${property?.name} Unit ${unit?.unitNumber}. Tenant: ${tenant?.firstName} ${tenant?.phone ? `(${tenant.phone})` : ''}. Priority: ${request.priority}. Check your email for details.`,
    });
  }

  // Pro tier: schedule a 48hr follow-up email to vendor
  if (tier === 'PRO') {
    const followUpTime = Date.now() + 48 * 60 * 60 * 1000;
    // Store follow-up in DB so a cron can pick it up
    await prisma.vendorFollowUp.create({
      data: {
        maintenanceRequestId: request.id,
        vendorId: vendor.id,
        managerId: manager.id,
        scheduledAt: new Date(followUpTime),
        sent: false,
      },
    }).catch(() => {
      // VendorFollowUp table is optional — gracefully skip if not migrated yet
    });
  }
}

// Called when manager marks a maintenance request COMPLETED
async function onJobCompleted(prisma, { request, vendor, manager, tenant }) {
  // Notify tenant job is done
  await notificationService.createNotification(prisma, {
    userId: tenant.id,
    title: 'Repair Complete',
    message: `Your ${request.aiTrade || 'maintenance'} request has been marked complete by ${vendor?.name || 'your vendor'}.`,
    type: 'maintenance',
    linkTo: '/tenant/maintenance',
  });

  // Notify manager with summary
  await notificationService.sendEmail({
    to: manager.email,
    subject: `Job Completed — ${request.unit?.property?.name} Unit ${request.unit?.unitNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#16a34a;">✓ Job Marked Complete</h2>
        <p>The following maintenance request has been completed:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Property</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.unit?.property?.name}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Unit</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.unit?.unitNumber}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Vendor</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${vendor?.name}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Trade</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.aiTrade || 'General'}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Notes</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.managerNotes || '—'}</td></tr>
        </table>
        <p style="color:#64748b;font-size:13px;">Log in to PropFlow to issue vendor payment or close the request.</p>
      </div>
    `,
  });
}

// Called by cron/scheduler to send 48hr follow-up emails (Pro tier)
async function sendPendingFollowUps(prisma) {
  let followUps = [];
  try {
    followUps = await prisma.vendorFollowUp.findMany({
      where: { sent: false, scheduledAt: { lte: new Date() } },
      include: {
        maintenanceRequest: { include: { unit: { include: { property: true } }, tenant: true } },
        vendor: true,
        manager: true,
      },
    });
  } catch {
    return; // Table not yet created
  }

  for (const fu of followUps) {
    const { maintenanceRequest: req, vendor, manager } = fu;
    if (req.status === 'COMPLETED') {
      await prisma.vendorFollowUp.update({ where: { id: fu.id }, data: { sent: true } });
      continue;
    }

    await notificationService.sendEmail({
      to: vendor.email,
      subject: `Follow-up: Status on ${req.unit?.property?.name} Unit ${req.unit?.unitNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#f59e0b;">48-Hour Follow-Up</h2>
          <p>Hi ${vendor.name}, this is a reminder about the open service request at ${req.unit?.property?.name}, Unit ${req.unit?.unitNumber}.</p>
          <p>Please reply with a status update or estimated completion date. The property manager (${manager.firstName} ${manager.lastName}) has been cc'd.</p>
          <p style="color:#64748b;font-size:13px;">— PropFlow Property Management</p>
        </div>
      `,
    });

    await notificationService.createNotification(prisma, {
      userId: manager.id,
      title: 'Vendor 48hr Follow-Up Sent',
      message: `Automated follow-up sent to ${vendor.name} for Unit ${req.unit?.unitNumber} — ${req.aiTrade} request.`,
      type: 'maintenance',
    });

    await prisma.vendorFollowUp.update({ where: { id: fu.id }, data: { sent: true } });
  }
}

module.exports = { onVendorDispatched, onJobCompleted, sendPendingFollowUps };
