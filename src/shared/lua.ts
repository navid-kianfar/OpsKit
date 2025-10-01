import { RedisClientType } from 'redis';

export async function loadScript(client: RedisClientType, script: string) {
  const sha = await client.scriptLoad(script);
  return (keys: string[], args: string[]) => client.evalSha(sha, { keys, arguments: args });
}

// Token bucket (atomic)
// KEYS[1]=bucketKey  ARGV[1]=capacity  ARGV[2]=refillRatePerSec  ARGV[3]=nowMs  ARGV[4]=tokensRequested  ARGV[5]=ttlSec
export const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local need = tonumber(ARGV[4])
local ttlSec = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local ts = tonumber(data[2]) or now

if now > ts then
  local delta = (now - ts) / 1000.0
  tokens = math.min(capacity, tokens + delta * rate)
  ts = now
end

local allowed = 0
local remaining = tokens
if tokens >= need then
  tokens = tokens - need
  remaining = tokens
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
if ttlSec > 0 then redis.call('EXPIRE', key, ttlSec) end

return {allowed, remaining, ts}
`;

// Named semaphore (bounded concurrency)
// KEYS[1]=semKey  ARGV[1]=limit  ARGV[2]=holderId  ARGV[3]=ttlSec
export const LUA_SEMAPHORE_ACQUIRE = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local holder = ARGV[2]
local ttl = tonumber(ARGV[3])

local cnt = tonumber(redis.call('SCARD', key)) or 0
if cnt >= limit then return 0 end
redis.call('SADD', key, holder)
if ttl > 0 then redis.call('EXPIRE', key, ttl) end
return 1
`;

export const LUA_SEMAPHORE_RELEASE = `
local key = KEYS[1]
local holder = ARGV[1]
redis.call('SREM', key, holder)
return 1
`;

// Idempotency: set if not exists
// KEYS[1]=idemKey  ARGV[1]=ttlSec
export const LUA_IDEMPOTENCY = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local ok = redis.call('SET', key, '1', 'NX', 'EX', ttl)
if ok then return 1 else return 0 end
`;

// Circuit breaker
// KEYS[1]=cbKey  ARGV[1]=state('closed'|'open'|'half')?  ARGV[2]=windowSec  ARGV[3]=threshold  ARGV[4]=halfOpenAfterSec?
export const LUA_CIRCUIT_UPDATE = `
local key = KEYS[1]
local action = ARGV[1]
local win = tonumber(ARGV[2])
local thr = tonumber(ARGV[3])

local now = redis.call('TIME')
local nowSec = tonumber(now[1])

if action == 'inc_success' or action == 'inc_failure' then
  local succKey = key..':succ:'..nowSec
  local failKey = key..':fail:'..nowSec
  if action == 'inc_success' then redis.call('INCR', succKey) else redis.call('INCR', failKey) end
  redis.call('EXPIRE', succKey, win * 2)
  redis.call('EXPIRE', failKey, win * 2)
end

local succ = 0
local fail = 0
for i=0,win-1 do
  succ = succ + tonumber(redis.call('GET', key..':succ:'..(nowSec - i)) or '0')
  fail = fail + tonumber(redis.call('GET', key..':fail:'..(nowSec - i)) or '0')
end
local total = succ + fail
local failureRate = 0
if total > 0 then failureRate = fail / total end

local state = redis.call('HGET', key, 'state') or 'closed'
local reopenAt = tonumber(redis.call('HGET', key, 'reopenAt') or '0')

if state == 'open' and nowSec >= reopenAt then
  state = 'half'
  redis.call('HSET', key, 'state', state)
end

if failureRate >= thr and total >= 10 then
  state = 'open'
  local halfAfter = tonumber(ARGV[4]) or win
  redis.call('HSET', key, 'state', state, 'reopenAt', nowSec + halfAfter)
elseif state == 'half' and failureRate < thr then
  state = 'closed'
  redis.call('HSET', key, 'state', state)
elseif state == 'closed' then
  redis.call('HSET', key, 'state', state)
end

return {state, tostring(failureRate), tostring(total)}
`;
