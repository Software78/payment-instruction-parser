const PaymentMessages = {
  // Success messages
  TRANSACTION_SUCCESSFUL: 'Transaction executed successfully',
  TRANSACTION_PENDING: 'Transaction scheduled for future execution',

  // Amount validation (AM01)
  INVALID_AMOUNT: 'Invalid amount. Amount must be a positive integer',

  // Currency validation
  CURRENCY_MISMATCH: 'Account currency mismatch. Both accounts must have the same currency',
  UNSUPPORTED_CURRENCY: 'Unsupported currency. Only NGN, USD, GBP, and GHS are supported',

  // Account validation
  INSUFFICIENT_FUNDS: 'Insufficient funds in debit account',
  SAME_ACCOUNT_ERROR: 'Debit and credit accounts cannot be the same',
  ACCOUNT_NOT_FOUND: 'Account not found',

  // Syntax validation
  MISSING_KEYWORDS: 'Missing required keywords',
  INVALID_KEYWORD_ORDER: 'Invalid keyword order',
  MALFORMED_INSTRUCTION: 'Malformed instruction: unable to parse keywords',
};

module.exports = PaymentMessages;
