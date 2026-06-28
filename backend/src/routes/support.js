const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the PropFlow Support Assistant — a friendly, knowledgeable helper for PropFlow, a property management platform.

You help two types of users:
1. PROPERTY MANAGERS — landlords and property managers who use PropFlow to manage properties, collect rent, handle maintenance, sign leases, and communicate with tenants.
2. TENANTS — renters who use PropFlow to pay rent, submit maintenance requests, view their lease, and get status updates.

KEY FEATURES YOU KNOW ABOUT:
- Maintenance requests: Tenants submit a photo + description in seconds → automatically dispatched to vendors → manager and tenant get progress notifications
- Rent payments: Tenants pay online via ACH bank linking, automatic reminders, late fee tracking
- Lease management: Upload PDF leases, extract key terms, send renewals via DocuSign e-signature
- Notifications: Managers set their own notification preferences — stay informed without being the middleman
- Onboarding: First login walks both managers and tenants through setup step by step
- Vendor network: Managers add preferred vendors by trade (plumber, electrician, HVAC, etc.)

SUPPORT CONTACT:
- Email: ${process.env.SUPPORT_EMAIL || 'support@propflow.app'}
- We respond within 24 hours for non-urgent issues

TONE: Warm, helpful, concise. No more than 3-4 sentences unless explaining a multi-step process. If you don't know something, say so and direct them to support@propflow.app.

Do NOT make up features. Do NOT reference any company other than PropFlow.`;

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
    res.status(500).json({ error: 'Support is temporarily unavailable. Email support@propflow.app for immediate help.' });
  }
});

module.exports = router;
