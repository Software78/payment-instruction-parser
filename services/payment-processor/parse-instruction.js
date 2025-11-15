const validator = require('@app-core/validator');
const { appLogger } = require('@app-core/logger');
const PaymentMessages = require('@app/messages/payment');

// Validator spec for input validation
const spec = `root {
  accounts[] {
    id string
    balance number
    currency string
  }
  instruction string
}`;

// Parse the spec once (outside the function)
const parsedSpec = validator.parse(spec);

// Supported currencies
const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'GHS'];

/**
 * Parse instruction string to extract transaction details
 * Uses only string manipulation (no regex)
 */
function parseInstruction(instruction) {
  const normalized = instruction.toLowerCase().trim();

  // Detect format type
  const isDebitFormat = normalized.startsWith('debit');
  const isCreditFormat = normalized.startsWith('credit');

  if (!isDebitFormat && !isCreditFormat) {
    return {
      type: null,
      amount: null,
      currency: null,
      debit_account: null,
      credit_account: null,
      execute_by: null,
      parseError: 'SY03',
    };
  }

  let type;
  let amount;
  let currency;
  let debitAccount;
  let creditAccount;
  let executeBy = null;

  if (isDebitFormat) {
    type = 'DEBIT';

    // Find keyword positions
    const debitPos = normalized.indexOf('debit');
    const fromAccountPos = normalized.indexOf('from account');
    const forCreditPos = normalized.indexOf('for credit to account');
    const onPos = normalized.indexOf(' on ');

    // Validate keyword order
    if (fromAccountPos === -1 || forCreditPos === -1) {
      return {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        parseError: 'SY01',
      };
    }

    if (debitPos >= fromAccountPos || fromAccountPos >= forCreditPos) {
      return {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        parseError: 'SY02',
      };
    }

    // Extract amount and currency (between "debit" and "from account")
    const amountCurrencyPart = normalized
      .substring(
        debitPos + 5, // "debit".length
        fromAccountPos
      )
      .trim();

    const parts = amountCurrencyPart.split(' ');
    if (parts.length < 2) {
      return {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        parseError: 'SY03',
      };
    }

    amount = parts[0].trim();
    currency = parts[1].trim().toUpperCase();

    // Extract debit account (between "from account" and "for credit to account")
    debitAccount = normalized
      .substring(
        fromAccountPos + 12, // "from account".length
        forCreditPos
      )
      .trim();

    // Extract credit account (after "for credit to account")
    let creditAccountEnd = normalized.length;
    if (onPos !== -1) {
      creditAccountEnd = onPos;
    }

    creditAccount = normalized
      .substring(
        forCreditPos + 21, // "for credit to account".length
        creditAccountEnd
      )
      .trim();

    // Extract date if present
    if (onPos !== -1) {
      executeBy = normalized.substring(onPos + 4).trim(); // " on ".length
    }
  } else {
    // CREDIT format
    type = 'CREDIT';

    // Find keyword positions
    const creditPos = normalized.indexOf('credit');
    const toAccountPos = normalized.indexOf('to account');
    const forDebitPos = normalized.indexOf('for debit from account');
    const onPos = normalized.indexOf(' on ');

    // Validate keyword order
    if (toAccountPos === -1 || forDebitPos === -1) {
      return {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        parseError: 'SY01',
      };
    }

    if (creditPos >= toAccountPos || toAccountPos >= forDebitPos) {
      return {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        parseError: 'SY02',
      };
    }

    // Extract amount and currency (between "credit" and "to account")
    const amountCurrencyPart = normalized
      .substring(
        creditPos + 6, // "credit".length
        toAccountPos
      )
      .trim();

    const parts = amountCurrencyPart.split(' ');
    if (parts.length < 2) {
      return {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        parseError: 'SY03',
      };
    }

    amount = parts[0].trim();
    currency = parts[1].trim().toUpperCase();

    // Extract credit account (between "to account" and "for debit from account")
    creditAccount = normalized
      .substring(
        toAccountPos + 10, // "to account".length
        forDebitPos
      )
      .trim();

    // Extract debit account (after "for debit from account")
    let debitAccountEnd = normalized.length;
    if (onPos !== -1) {
      debitAccountEnd = onPos;
    }

    debitAccount = normalized
      .substring(
        forDebitPos + 22, // "for debit from account".length
        debitAccountEnd
      )
      .trim();

    // Extract date if present
    if (onPos !== -1) {
      executeBy = normalized.substring(onPos + 4).trim(); // " on ".length
    }
  }

  return {
    type,
    amount,
    currency,
    debit_account: debitAccount,
    credit_account: creditAccount,
    execute_by: executeBy || null,
    parseError: null,
  };
}

/**
 * Validate amount is a positive integer (no decimals)
 */
function validateAmount(amountStr) {
  if (!amountStr || amountStr.length === 0) {
    return { valid: false, value: null };
  }

  // Check for negative sign
  if (amountStr.indexOf('-') !== -1) {
    return { valid: false, value: null };
  }

  // Check for decimal point
  if (amountStr.indexOf('.') !== -1) {
    return { valid: false, value: null };
  }

  // Try to parse as integer
  const amountNum = parseInt(amountStr, 10);
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    return { valid: false, value: null };
  }

  // Verify it's exactly the same as the string (no extra characters)
  if (amountNum.toString() !== amountStr) {
    return { valid: false, value: null };
  }

  return { valid: true, value: amountNum };
}

/**
 * Validate date format YYYY-MM-DD
 */
function validateDate(dateStr) {
  if (!dateStr || dateStr.length === 0) {
    return { valid: false, value: null };
  }

  // Check format: should be exactly 10 characters (YYYY-MM-DD)
  if (dateStr.length !== 10) {
    return { valid: false, value: null };
  }

  // Check for dashes at positions 4 and 7
  if (dateStr.charAt(4) !== '-' || dateStr.charAt(7) !== '-') {
    return { valid: false, value: null };
  }

  // Extract parts
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(5, 7);
  const day = dateStr.substring(8, 10);

  // Check all parts are numeric
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);

  if (Number.isNaN(yearNum) || Number.isNaN(monthNum) || Number.isNaN(dayNum)) {
    return { valid: false, value: null };
  }

  // Basic validation
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return { valid: false, value: null };
  }

  return { valid: true, value: dateStr };
}

/**
 * Check if date is in the future
 */
function isFutureDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
}

/**
 * Find account by ID
 */
function findAccount(accounts, accountId) {
  for (let i = 0; i < accounts.length; i += 1) {
    if (accounts[i].id === accountId) {
      return accounts[i];
    }
  }
  return null;
}

/**
 * Get accounts in request order
 */
function getAccountsInOrder(accounts, debitAccountId, creditAccountId) {
  const result = [];

  // Maintain order from request
  for (let i = 0; i < accounts.length; i += 1) {
    if (accounts[i].id === debitAccountId || accounts[i].id === creditAccountId) {
      result.push({
        id: accounts[i].id,
        balance: accounts[i].balance,
        balance_before: accounts[i].balance,
        currency: accounts[i].currency.toUpperCase(),
      });
    }
  }

  return result;
}

/**
 * Main service function
 */
// eslint-disable-next-line no-unused-vars
async function parseInstructionService(serviceData, _options = {}) {
  let response;

  // Validate input data
  const data = validator.validate(serviceData, parsedSpec);

  try {
    // Parse instruction
    const parsed = parseInstruction(data.instruction);

    // If completely unparseable, return error response
    if (parsed.parseError === 'SY03') {
      response = {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: PaymentMessages.MALFORMED_INSTRUCTION,
        status_code: 'SY03',
        accounts: [],
      };
      return response;
    }

    // If missing keywords or invalid order
    if (parsed.parseError === 'SY01' || parsed.parseError === 'SY02') {
      response = {
        type: parsed.type,
        amount: parsed.amount ? parseInt(parsed.amount, 10) : null,
        currency: parsed.currency,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason:
          parsed.parseError === 'SY01'
            ? PaymentMessages.MISSING_KEYWORDS
            : PaymentMessages.INVALID_KEYWORD_ORDER,
        status_code: parsed.parseError,
        accounts: [],
      };
      return response;
    }

    // Validate amount
    const amountValidation = validateAmount(parsed.amount);
    if (!amountValidation.valid) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount: null,
        currency: parsed.currency,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.INVALID_AMOUNT,
        status_code: 'AM01',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    const amount = amountValidation.value;

    // Validate currency
    const currencyUpper = parsed.currency.toUpperCase();
    if (SUPPORTED_CURRENCIES.indexOf(currencyUpper) === -1) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount,
        currency: parsed.currency,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.UNSUPPORTED_CURRENCY,
        status_code: 'CU02',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    // Find accounts
    const debitAccount = findAccount(data.accounts, parsed.debit_account);
    const creditAccount = findAccount(data.accounts, parsed.credit_account);

    if (!debitAccount || !creditAccount) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.ACCOUNT_NOT_FOUND,
        status_code: 'AC03',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    // Validate accounts are different
    if (debitAccount.id === creditAccount.id) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.SAME_ACCOUNT_ERROR,
        status_code: 'AC02',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    // Validate currency match
    const debitCurrency = debitAccount.currency.toUpperCase();
    const creditCurrency = creditAccount.currency.toUpperCase();

    if (debitCurrency !== creditCurrency) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.CURRENCY_MISMATCH,
        status_code: 'CU01',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    // Validate instruction currency matches account currency
    if (currencyUpper !== debitCurrency) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.CURRENCY_MISMATCH,
        status_code: 'CU01',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    // Validate date if present
    let isPending = false;
    if (parsed.execute_by) {
      const dateValidation = validateDate(parsed.execute_by);
      if (!dateValidation.valid) {
        // Invalid date format - treat as unparseable
        const accountsInOrder = getAccountsInOrder(
          data.accounts,
          parsed.debit_account,
          parsed.credit_account
        );

        response = {
          type: parsed.type,
          amount,
          currency: currencyUpper,
          debit_account: parsed.debit_account,
          credit_account: parsed.credit_account,
          execute_by: parsed.execute_by,
          status: 'failed',
          status_reason: PaymentMessages.MALFORMED_INSTRUCTION,
          status_code: 'SY03',
          accounts: accountsInOrder.map((acc) => ({
            id: acc.id,
            balance: acc.balance,
            balance_before: acc.balance,
            currency: acc.currency,
          })),
        };
        return response;
      }

      // Check if future date
      isPending = isFutureDate(parsed.execute_by);
    }

    // Validate sufficient funds (only for immediate execution)
    if (!isPending && debitAccount.balance < amount) {
      const accountsInOrder = getAccountsInOrder(
        data.accounts,
        parsed.debit_account,
        parsed.credit_account
      );

      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'failed',
        status_reason: PaymentMessages.INSUFFICIENT_FUNDS,
        status_code: 'AC01',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
      return response;
    }

    // Execute transaction
    const accountsInOrder = getAccountsInOrder(
      data.accounts,
      parsed.debit_account,
      parsed.credit_account
    );

    if (isPending) {
      // Pending transaction - balances unchanged
      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'pending',
        status_reason: PaymentMessages.TRANSACTION_PENDING,
        status_code: 'AP01',
        accounts: accountsInOrder.map((acc) => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency,
        })),
      };
    } else {
      // Execute immediately
      const updatedAccounts = accountsInOrder.map((acc) => {
        const balanceBefore = acc.balance;
        let newBalance = balanceBefore;

        if (acc.id === debitAccount.id) {
          newBalance = balanceBefore - amount;
        } else if (acc.id === creditAccount.id) {
          newBalance = balanceBefore + amount;
        }

        return {
          id: acc.id,
          balance: newBalance,
          balance_before: balanceBefore,
          currency: acc.currency,
        };
      });

      response = {
        type: parsed.type,
        amount,
        currency: currencyUpper,
        debit_account: parsed.debit_account,
        credit_account: parsed.credit_account,
        execute_by: parsed.execute_by,
        status: 'successful',
        status_reason: PaymentMessages.TRANSACTION_SUCCESSFUL,
        status_code: 'AP00',
        accounts: updatedAccounts,
      };
    }
  } catch (error) {
    appLogger.errorX(error, 'parse-instruction-error');
    throw error;
  }

  return response;
}

module.exports = parseInstructionService;
