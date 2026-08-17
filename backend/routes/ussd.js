const express = require('express');
const router = express.Router();
const { handleUSSDSession } = require('../services/ussd');
const logger = require('../utils/logger');

/**
 * @openapi
 * /ussd:
 *   post:
 *     summary: Africa's Talking USSD Gateway callback webhook
 *     tags: [USSD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - phoneNumber
 *               - text
 *             properties:
 *               sessionId:
 *                 type: string
 *               serviceCode:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: USSD menu response (text/plain starting with CON or END)
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    const responseText = await handleUSSDSession({
      sessionId: sessionId || req.query.sessionId,
      serviceCode: serviceCode || req.query.serviceCode,
      phoneNumber: phoneNumber || req.query.phoneNumber,
      text: text || req.query.text || ''
    });

    res.setHeader('Content-Type', 'text/plain');
    res.send(responseText);
  } catch (error) {
    logger.error('USSD processing error', { error: error.message });
    res.setHeader('Content-Type', 'text/plain');
    res.send('END An error occurred processing your request. Please try again later.');
  }
});

module.exports = router;
