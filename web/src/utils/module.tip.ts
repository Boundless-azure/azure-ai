/**
 * @title Utils Module Description
 * @description Description and keyword mapping for the Utils module.
 */

export const moduleDescription = {
  name: 'utils',
  description:
    'Shared utility functions, HTTP client, and base type definitions.',
  keywords: {
    'http-client': {
      cn: 'HTTP客户端',
      en: 'HTTP Client',
      file: 'http.ts',
      functions: {
        get: 'get',
        post: 'post',
        put: 'put',
        delete: 'delete',
        addRequestInterceptor: 'addRequestInterceptor',
        addResponseInterceptor: 'addResponseInterceptor',
      },
    },
    'base-types': {
      cn: '基础类型',
      en: 'Base Types',
      file: 'types.ts',
      functions: {},
    },
  },
};
