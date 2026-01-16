// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
    integrations: [vue({
        appEntrypoint: '/src/entrypoint'
    }), tailwind()],
    server: {
        port: 3001
    },
    vite: {
        server: {
            proxy: {
                '/api': {
                    target: process.env.API_URL || 'http://127.0.0.1:3000',
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
            },
        },
    },
});
