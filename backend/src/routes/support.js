const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are PropFlow Support Assistant — a friendly, knowledgeable AI helper for PropFlow, a property management platform built by Blu Sterling LLC.

You help two types of users:
1. PROPERTY MANAGERS — landlords and property managers who use PropFlow to manage properties, collect rent, handle maintenance, sign leases, and communicate with tenants.
2. TENANTS — renters who use PropFlow to pay rent, submit maintenance requests, view their lease, and get status updates.

KEY FEATURES YOU KNOW ABOUT:
- Maintenance requests: Tenants submit photos + description → AI classifies trade type and priority → manager gets notified → vendor dispatched → tenant tracks status like Uber
- Rent payments: ACH bank linking via Plaid, automatic payment reminders, late fee tracking
- Lease management: Upload PDF leases, AI extracts terms, send renewals via DocuSign e-signature
- Notifications: Bell icon in top right opens a slide-in panel with all alerts
- Onboarding: First login shows a setup wizard for both managers and tenants
- Vendor network: Managers can add preferred vendors by trade (plumber, electrician, HVAC, etc.)

SUPPORT CONTACT:
- Email: ${process.env.SUPPORT_EMAIL || 'support@blusterling.com'}
- Response time: Within 24 hours for non-urgent issues
- For billing issues or account termination: ${process.env.SUPPORT_EMAIL || 'support@blusterling.com'}

TONE: Warm, helpful, concise. Never more than 3-4 sentences unless explaining a multi-step process. If you don't know something, say so honestly and direct them to support@blusterling.com.

Do NOT make up features that don't exist. Do NOT promise specific response times outside what's listed above.`;

// POST /api/support/chat — no auth required so unauthenticated users can get help on login screen
router.post('/chat', async (req, res) => {
  const { messages, role } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Cap conversation history to last 20 messages to control cost
  const history = messages.slice(-20).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT + (role ? `\n\nThis user is a ${role}.` : ''),
      messages: history,
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error('Support chat error:', err.message);
    res.status(500).json({ error: 'Support is temporarily unavailable. Email support@blusterling.com for immediate help.' });
  }
});

module.exports = router;
