import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.strict,
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error'],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
);
