import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on
 * the client side for web. useSyncExternalStore's getServerSnapshot
 * argument is the built-in tool for exactly this — a value that must
 * differ between server and first client render without the
 * effect+setState hydration-flag pattern this replaced, which
 * eslint-config-expo's react-hooks/set-state-in-effect rule flags
 * (calling setState synchronously inside an effect body).
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  return useSyncExternalStore(
    emptySubscribe,
    () => colorScheme,
    () => 'light',
  );
}
