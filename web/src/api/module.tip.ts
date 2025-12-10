/**
 * @title API Module Description
 * @description Description and keyword mapping for the API module.
 */

export const moduleDescription = {
  name: 'api',
  description: 'Centralized API definitions and endpoints for the application.',
  keywords: {
    'agent-api': {
      cn: '代理API',
      en: 'Agent API',
      file: 'agent.ts',
      functions: {
        'getHistory': 'getHistory',
        'getWorkflow': 'getWorkflow',
        'sendMessage': 'sendMessage'
      }
    }
  }
};
