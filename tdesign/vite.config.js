import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import VueDevTools from 'vite-plugin-vue-devtools'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import UnoCss from 'unocss/vite'
import { localFlowField } from './server/local-flow-field.mjs'


const staticPath = './'


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const flowProxyTarget = env.VITE_FLOW_PROXY_TARGET

    return {
        base: staticPath,
        build: {
            minify: true,
            sourcemap: true
        },

        plugins: [
            env.VITE_FLOW_DATA_SOURCE === 'local' && localFlowField({ packageDir: env.VITE_FLOW_LOCAL_PACKAGE }),
            vue(),
            vueJsx(),
            mode !== 'demo' && VueDevTools(),
            UnoCss(),
            AutoImport({
                resolvers: [
                    TDesignResolver({
                        library: 'vue-next'
                    })
                ]
            }),
            Components({
                resolvers: [
                    TDesignResolver({
                        library: 'vue-next'
                    })
                ]
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
            strictPort: false,
            proxy: flowProxyTarget
                ? {
                      '/flow-field': {
                          target: flowProxyTarget,
                          changeOrigin: true
                      }
                  }
                : undefined
        }
    }
})
