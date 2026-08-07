const logger = require('./logger');

const validTransitions = {
  'PENDING_VIEWING': ['VIEWED_UNLOCKED', 'PAYMENT_CONFIRMED', 'MANUAL_REVIEW', 'FAILED'],
  'VIEWED_UNLOCKED': ['PAYMENT_CONFIRMED', 'MANUAL_REVIEW', 'FAILED'],
  'PAYMENT_CONFIRMED': ['HOUSE_LOCKED', 'MANUAL_REVIEW', 'REVERSED'],
  'HOUSE_LOCKED': ['PENDING_VIEWING', 'MANUAL_REVIEW', 'REVERSED'],
  'MANUAL_REVIEW': ['PENDING_VIEWING', 'VIEWED_UNLOCKED', 'PAYMENT_CONFIRMED', 'HOUSE_LOCKED', 'FAILED', 'REVERSED'],
  'FAILED': ['PENDING_VIEWING', 'MANUAL_REVIEW'],
  'REVERSED': ['MANUAL_REVIEW']
};

function canTransition(from, to) {
  return validTransitions[from]?.includes(to) || false;
}

function transition(payment, newState) {
  if (!canTransition(payment.workflow_state, newState)) {
    logger.error('Invalid state transition attempted', { from: payment.workflow_state, to: newState, paymentId: payment._id });
    throw Object.assign(new Error(`Invalid transition: ${payment.workflow_state} -> ${newState}`), { status: 400, code: 'INVALID_STATE_TRANSITION' });
  }
  payment.workflow_state = newState;
  return payment;
}

module.exports = { canTransition, transition, validTransitions };
