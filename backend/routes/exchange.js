const express = require('express');
const router = express.Router();
const { getLiveCBKRate } = require('../services/cbkExchangeRate');

/**
 * @openapi
 * /exchange/cbk-rate:
 *   get:
 *     summary: Get live Central Bank of Kenya USD/KES exchange rate
 *     tags: [Exchange]
 *     responses:
 *       200:
 *         description: Live exchange rate data
 */
router.get('/cbk-rate', async (req, res, next) => {
  try {
    const rate = await getLiveCBKRate();
    res.json({
      success: true,
      data: {
        currency_pair: 'USD/KES',
        rate,
        source: 'Central Bank of Kenya (CBK) / Live Forex Feed',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
