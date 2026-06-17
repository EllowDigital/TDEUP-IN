import eslintConfigNext from "eslint-config-next";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

const eslintConfig = [...eslintConfigNext, eslintPluginPrettierRecommended];

export default eslintConfig;
