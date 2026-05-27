declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  /** API base path, e.g. "/api". Set at app init from resolvedBase. Component JS reads this instead of hardcoding. */
  __apiBase: string;
}
