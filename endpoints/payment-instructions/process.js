const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const parseInstructionService = require('@app/services/payment-processor/parse-instruction');

module.exports = createHandler({
  path: '/payment-instructions',
  method: 'post',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'payment-instruction-request-completed');
  },
  async handler(rc, helpers) {
    const payload = rc.body;

    const response = await parseInstructionService(payload);
    return {
      status: helpers.http_statuses.HTTP_200_OK,
      data: response,
    };
  },
});
