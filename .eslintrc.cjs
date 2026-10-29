module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['build', 'node_modules', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      // Provider + hook pairs, shared field helpers and the entry file:
      // fast refresh falls back to a full reload here, which is fine.
      files: ['src/contexts/*.tsx', 'src/components/ui/Input.tsx', 'src/components/ui/Modal.tsx', 'src/components/ui/DateInput.tsx', 'src/main.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
