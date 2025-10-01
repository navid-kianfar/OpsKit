export type RateLimitMode = 'token-bucket' | 'sliding-window' | 'fixed-window';
export type OnLimitAction = 'wait' | 'queue' | 'fail';
export type CircuitState = 'closed' | 'open' | 'half';
