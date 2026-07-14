import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import VueDevTools from 'vite-plugin-vue-devtools'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import UnoCss from 'unocss/vite'


const staticPath = './'


// https://vitejs.dev/config/
export default defineConfig({
    base: staticPath,
    build: {
        minify: true,
        sourcemap: true
    },

    plugins: [
        vue(),
        vueJsx(),
        VueDevTools(),
        UnoCss(),
        AutoImport({
            resolvers: [
                TDesignResolver({
                    library: 'vue-next'
                })
            ],
        }),
        Components({
            resolvers: [
                TDesignResolver({
                    library: 'vue-next'
                })
            ],
        })
    ],

    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },

    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `@use "@/style/variables.scss" as * with ($baseUrl:"${staticPath}");`
            }
        }
    },

    server: {
        host: '0.0.0.0',
        port: 5175,
        strictPort: false
    }
})
