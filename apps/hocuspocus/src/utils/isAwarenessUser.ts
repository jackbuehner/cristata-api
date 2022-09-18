import { hasKey, isObject } from '@jackbuehner/cristata-utils';

export interface AwarenessUser {
  user: {
    name: string;
    color: string;
    sessionId: string;
    photo: string;
  };
}

export function isAwarenessUser(toCheck: unknown): toCheck is AwarenessUser {
  return (
    isObject(toCheck) &&
    hasKey('user', toCheck) &&
    isObject(toCheck.user) &&
    hasKey('name', toCheck.user) &&
    hasKey('color', toCheck.user) &&
    hasKey('sessionId', toCheck.user) &&
    hasKey('photo', toCheck.user)
  );
}
