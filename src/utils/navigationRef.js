import { createRef } from 'react';

/**
 * Global navigation ref — passed to <NavigationContainer ref={navigationRef} />.
 * Use navigate() from anywhere outside the component tree (e.g. AppContext,
 * push notification handlers) to navigate without the useNavigation hook.
 */
export const navigationRef = createRef();

export function navigate(name, params) {
  if (navigationRef.current?.isReady?.()) {
    navigationRef.current.navigate(name, params);
  }
}
