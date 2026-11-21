import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import oxlint from 'eslint-plugin-oxlint'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    ...oxlint.configs['flat/recommended'],
    {
        name: 'app/files-to-lint',
        files: ['**/*.{js,mjs,jsx,vue}'],
        languageOptions: {
            globals: {
                APIS: 'readonly',
                SYSTEM_CONFIG: 'readonly',
                MapSynchronizer: 'readonly',
                SuperMap3DEx: 'readonly',
                console: 'readonly',
                document: 'readonly',
                ol: 'readonly',
                onemap: 'readonly',
                window: 'readonly'
            }
        },
        rules: {
            'vue/multi-word-component-names': 'off',
            'import/named': 'off'
        }
    },
    {
        name: 'app/files-to-ignore',
        ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'public/**', 'src/@icons/**', '*.config.js']
    },
    skipFormatting
]
