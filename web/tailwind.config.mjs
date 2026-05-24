/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
            colors: {
              primary: '#000000',
            },
            boxShadow: {
              glow: '0 0 20px -5px rgba(0, 0, 0, 0.1)',
              'glow-lg': '0 0 30px -5px rgba(0, 0, 0, 0.15)',
            },
		},
	},
	plugins: [],
}
