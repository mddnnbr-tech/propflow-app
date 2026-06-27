// Market rent comparison service — Pro tier feature
// Uses RentCast API: https://app.rentcast.io/docs
// Free tier: 50 calls/month. Paid plans from $29/mo.
// Set RENTCAST_API_KEY in .env to activate.

const https = require('https');

async function fetchMarketRent({ address, city, state, zip, bedrooms, bathrooms }) {
  const apiKey = process.env.RENTCAST_API_KEY;

  if (!apiKey) {
    return { available: false, reason: 'RENTCAST_API_KEY not configured' };
  }

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      address: `${address}, ${city}, ${state} ${zip}`,
      bedrooms: bedrooms || 1,
      bathrooms: bathrooms || 1,
      propertyType: 'Apartment',
    });

    const options = {
      hostname: 'api.rentcast.io',
      path: `/v1/avm/rent/long-term?${params}`,
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200) {
            resolve({ available: false, reason: json.message || 'RentCast API error' });
            return;
          }
          resolve({
            available: true,
            rentEstimate: json.rent,
            rentRangeLow: json.rentRangeLow,
            rentRangeHigh: json.rentRangeHigh,
            comparables: (json.comparables || []).slice(0, 3).map((c) => ({
              address: c.formattedAddress,
              rent: c.price,
              bedrooms: c.bedrooms,
              bathrooms: c.bathrooms,
              distance: c.distance,
            })),
          });
        } catch {
          resolve({ available: false, reason: 'Failed to parse RentCast response' });
        }
      });
    });

    req.on('error', () => resolve({ available: false, reason: 'Network error reaching RentCast' }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ available: false, reason: 'RentCast timeout' }); });
    req.end();
  });
}

// Returns market comparison for a lease — compares current rent to market
async function getLeaseMarketComparison(lease) {
  const property = lease.unit?.property;
  const unit = lease.unit;

  if (!property) return null;

  const marketData = await fetchMarketRent({
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    bedrooms: unit?.bedrooms || 1,
    bathrooms: unit?.bathrooms || 1,
  });

  if (!marketData.available) return { available: false, reason: marketData.reason };

  const currentRent = lease.rentAmount;
  const marketRent = marketData.rentEstimate;
  const difference = marketRent - currentRent;
  const pctDiff = ((difference / currentRent) * 100).toFixed(1);

  return {
    available: true,
    currentRent,
    marketRent,
    rentRangeLow: marketData.rentRangeLow,
    rentRangeHigh: marketData.rentRangeHigh,
    difference,
    pctDiff: parseFloat(pctDiff),
    recommendation: buildRecommendation(currentRent, marketRent, difference),
    comparables: marketData.comparables,
  };
}

function buildRecommendation(currentRent, marketRent, diff) {
  if (diff > currentRent * 0.15) {
    return {
      action: 'INCREASE',
      urgency: 'high',
      message: `Current rent is ${Math.abs(diff.toFixed(0))} below market. Consider increasing to $${Math.round(marketRent * 0.97)} at renewal (3% below market to retain tenant).`,
    };
  }
  if (diff > currentRent * 0.05) {
    return {
      action: 'INCREASE',
      urgency: 'medium',
      message: `Rent is slightly below market. A modest increase of $${Math.round(diff * 0.5)} at renewal would be reasonable.`,
    };
  }
  if (diff < -currentRent * 0.05) {
    return {
      action: 'HOLD',
      urgency: 'low',
      message: `Current rent is above market. Consider holding rent flat at renewal to retain the tenant.`,
    };
  }
  return {
    action: 'HOLD',
    urgency: 'low',
    message: `Rent is at market rate. Consider a modest 2–3% cost-of-living increase at renewal.`,
  };
}

module.exports = { getLeaseMarketComparison, fetchMarketRent };
