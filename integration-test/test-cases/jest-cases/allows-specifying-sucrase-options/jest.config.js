module.exports = {
  transform: {"\\.(js|jsx|ts|tsx)$": ["@sucrase/jest-plugin", {jsxRuntime: "automatic"}]},
};
