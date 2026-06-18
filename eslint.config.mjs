import eslintConfigNext from "eslint-config-next";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: [".next/**", ".open-next/**", "node_modules/**", "dist/**", "out/**", "coverage/**"],
  },

  ...eslintConfigNext,

  eslintPluginPrettierRecommended,
];
