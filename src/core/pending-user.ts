import type { UserContext } from '../types';

let pendingUser: UserContext | null = null;

/** Skavelo.identify() before Skavelo.init(): remembered until the widget starts. */
export const setPendingUser = (user: UserContext) => { pendingUser = user; };
export const takePendingUser = (): UserContext | null => pendingUser;
