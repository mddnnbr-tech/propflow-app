const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

async function createLinkToken(userId, email) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId, email_address: email },
    client_name: 'PropAI',
    products: [Products.Auth, Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: process.env.PLAID_WEBHOOK_URL,
  });
  return response.data.link_token;
}

async function exchangePublicToken(publicToken) {
  const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = response.data.access_token;
  const itemId = response.data.item_id;

  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = accountsResponse.data.accounts;

  return { accessToken, itemId, accounts };
}

async function initiateACH({ accessToken, accountId, amount }) {
  // In production, use Plaid Transfer or connect to ACH processor (Dwolla/Stripe)
  // Here we use Plaid's payment initiation (available in sandbox)
  // For a real implementation, you'd integrate with Dwolla or Stripe ACH
  // and use the Plaid account/routing numbers to create the transfer.

  // Get account/routing numbers
  const authResponse = await plaidClient.authGet({ access_token: accessToken });
  const account = authResponse.data.numbers.ach.find((a) => a.account_id === accountId);

  if (!account) throw new Error('ACH account not found');

  // Placeholder: In production, submit to your ACH processor with:
  // account.account (account number), account.routing (routing number), amount
  // Return a transaction ID
  const transactionId = `plaid_ach_${Date.now()}_${accountId.slice(-6)}`;
  console.log(`ACH initiated: $${amount} from account ending ${account.account.slice(-4)}, routing ${account.routing}`);

  return transactionId;
}

async function getBalance(accessToken, accountId) {
  const response = await plaidClient.accountsBalanceGet({ access_token: accessToken });
  const account = response.data.accounts.find((a) => a.account_id === accountId);
  return account?.balances || null;
}

module.exports = { createLinkToken, exchangePublicToken, initiateACH, getBalance };
