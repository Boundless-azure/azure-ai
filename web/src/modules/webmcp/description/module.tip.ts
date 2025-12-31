/**
 * @title WebMCP Module Tip (Web)
 * @description Description and keyword mapping for WebMCP web SDK.
 */

export const moduleDescription = {
  name: 'webmcp',
  description:
    'Web SDK for WebMCP page declaration, socket handshake, and operation dispatch.',
  keywords: {
    types: {
      cn: '类型',
      en: 'Types',
      file: 'types/webmcp.types.ts',
      functions: {},
    },
    registry: {
      cn: '注册表',
      en: 'Registry',
      file: 'services/webmcp.registry.service.ts',
      functions: {
        registerPage: 'registerPage',
        execute: 'execute',
        on: 'on',
      },
    },
    client: {
      cn: '客户端',
      en: 'Client',
      file: 'services/webmcp.client.service.ts',
      functions: {
        connect: 'connect',
        registerCurrentPage: 'registerCurrentPage',
      },
    },
    controller: {
      cn: '控制器',
      en: 'Controller',
      file: 'controller/webmcp.controller.ts',
      functions: {
        createWebMcpController: 'createWebMcpController',
      },
    },
    sdk: {
      cn: 'SDK',
      en: 'SDK',
      file: 'sdk.ts',
      functions: {
        createWebMcpSDK: 'createWebMcpSDK',
      },
    },
  },
  hashMap: {
    registerPage: 'hash_registerPage_001',
    execute: 'hash_execute_002',
    on: 'hash_on_003',
    connect: 'hash_connect_004',
    registerCurrentPage: 'hash_registerCurrent_005',
    createWebMcpController: 'hash_createController_006',
    createWebMcpSDK: 'hash_createSdk_007',
  },
};
