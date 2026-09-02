/**
 * jest-expo's preset, which wires up the React Native/Expo module
 * mapping and transforms — a plain ts-jest setup cannot resolve
 * `react-native` or the `@/` alias the way Metro does.
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleNameMapper: {
    // constants/theme.ts imports global.css for NativeWind-style web
    // theming; Metro handles that, jest has no CSS transform and chokes
    // on the first selector. Nothing under test asserts on styling, so
    // an empty stub is the honest mapping rather than a workaround.
    "\\.css$": "<rootDir>/__mocks__/style-mock.js",
  },
};
