module.exports = {
  extends: ["plugin:react-hooks/recommended"],
  parserOptions: {
    project: `${__dirname}/tsconfig.json`,
  },
  rules: {
    "react-hooks/exhaustive-deps": "error",
  },
};
