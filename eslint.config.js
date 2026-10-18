import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // supabase/는 Deno 런타임 → deno lint/check로 따로 검사
  { ignores: ['dist', 'node_modules', 'supabase'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 앱인토스 검수: iframe 사용 시 반려
      'no-restricted-syntax': [
        'error',
        { selector: "JSXOpeningElement[name.name='iframe']", message: '앱인토스에서 iframe은 사용할 수 없어요.' },
      ],
    },
  },
);
