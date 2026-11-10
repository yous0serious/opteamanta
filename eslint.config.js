import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const SIM_MSG = 'src/sim muss deterministisch bleiben (ADR-0002)';
const bannedMath = ['random', 'hypot', 'pow', 'sin', 'cos', 'tan', 'atan2', 'exp', 'log'];

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', '.tmp/', 'node_modules/', 'playwright-report/', 'test-results/', 'tower-defenese-opTEAManta-v2.html'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Determinismus-Regeln für die Simulation (Spec foundation-phaser-port, AC-9)
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-properties': [
        'error',
        ...bannedMath.map((property) => ({ object: 'Math', property, message: SIM_MSG })),
      ],
      'no-restricted-globals': [
        'error',
        ...['Date', 'performance', 'window', 'document', 'navigator', 'localStorage'].map((name) => ({ name, message: SIM_MSG })),
      ],
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'phaser', message: SIM_MSG }], patterns: [{ group: ['phaser/*'], message: SIM_MSG }] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: SIM_MSG },
        { selector: "AssignmentExpression[operator='**=']", message: SIM_MSG },
      ],
    },
  },
);
