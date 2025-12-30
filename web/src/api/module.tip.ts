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
        getGroupHistory: 'getGroupHistory',
        sendMessage: 'sendMessage',
        getGroupList: 'getGroupList',
        getGroupDetail: 'getGroupDetail',
        createGroup: 'createGroup',
        updateGroup: 'updateGroup',
        deleteGroup: 'deleteGroup',
        getGroupSummaries: 'getGroupSummaries',
        listCheckpoints: 'listCheckpoints',
        getCheckpointDetail: 'getCheckpointDetail',
        getWorkflow: 'getWorkflow',
      },
    },
    'todo-api': {
      cn: '待办API',
      en: 'Todo API',
      file: 'todo.ts',
      functions: {
        list: 'list',
        get: 'get',
        create: 'create',
        update: 'update',
        delete: 'delete',
      },
    },
  },
};
