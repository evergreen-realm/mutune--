const axios = require('axios');
const logger = require('../utils/logger');

let cachedRate = 129.50; // Default fallback CBK KES/USD exchange rate
let lastFetched = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function getLiveCBKRate() {
  const now = Date.now();
  if (cachedRate && (now - lastFetched < CACHE_TTL_MS)) {
    return cachedRate;
  }

  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
    if (response?.data?.rates?.KES) {
      cachedRate = Number(response.data.rates.KES.toFixed(2));
      lastFetched = now;
      logger.info('Fetched live Central Bank of Kenya (CBK) exchange rate', { rate: cachedRate });
      return cachedRate;
    }
  } catch (err) {
    logger.warn('Failed to fetch live CBK exchange rate, using cached fallback', { error: err.message, rate: cachedRate });
  }

  return cachedRate;
}

module.exports = {
  getLiveCBKRate
};
