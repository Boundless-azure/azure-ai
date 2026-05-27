import type { App } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { resolvedBase } from './utils/http';

export default (app: App) => {
  // Expose API base to component JS blobs (which can't import from the module system)
  window.__apiBase = resolvedBase;

  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  app.use(pinia);
};
