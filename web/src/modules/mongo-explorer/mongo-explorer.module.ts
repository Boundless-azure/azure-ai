/**
 * @title MongoExplorer Module Definition
 * @description Exports and configuration for the MongoExplorer module.
 * @keywords-cn MongoDB浏览器模块定义, 导出, 配置
 * @keywords-en mongo-explorer-module-definition, exports, configuration
 */

import { useMongoExplorer } from './hooks/useMongoExplorer';
import MongoExplorer from './components/MongoExplorer.vue';

export const MongoExplorerModule = {
  name: 'MongoExplorerModule',
  hooks: { useMongoExplorer },
  components: { MongoExplorer },
};

export * from './types/mongo-explorer.types';
export { useMongoExplorer } from './hooks/useMongoExplorer';
