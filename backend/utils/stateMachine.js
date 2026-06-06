const logger = require('./logger');

const validTransitions = {
  'PENDING_VIEWING': ['VIEWED_UNLOCKED', 'PAYMENT_CONFIRMED', 'MANUAL_REVIEW'],
  'VIEWED_UNLOCKED': ['PAYMENT_CONFIRMED', 'MANUAL_REVIEW'],
  'PAYMENT_CONFIRMED': ['HOUSE_LOCKED', 'MANUAL_REVIEW'],
  'HOUSE_LOCKED': ['PENDING_VIEWING', 'MANUAL_REVIEW'],
  'MANUAL_REVIEW': ['PENDING_VIEWING', 'VIEWED_UNLOCKED', 'PAYMENT_CONFIRMED', 'HOUSE_LOCKED']
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
