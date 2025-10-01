import { VersionedNodeType } from 'n8n-workflow';
import { RateLimitGate } from './nodes/RateLimitGate.node';
import { SemaphoreNode } from './nodes/Semaphore.node';
import { CircuitBreakerNode } from './nodes/CircuitBreaker.node';
import { IdempotencyNode } from './nodes/Idempotency.node';
import { BackoffRetryNode } from './nodes/BackoffRetry.node';
import { DeadLetterNode } from './nodes/DeadLetter.node';
import { DLQReplayerNode } from './nodes/DLQReplayer.node';
import { OpsKitRedisApi } from './credentials/OpsKitRedisApi.credentials';

export const nodes: VersionedNodeType[] = [
  RateLimitGate as unknown as VersionedNodeType,
  SemaphoreNode as unknown as VersionedNodeType,
  CircuitBreakerNode as unknown as VersionedNodeType,
  IdempotencyNode as unknown as VersionedNodeType,
  BackoffRetryNode as unknown as VersionedNodeType,
  DeadLetterNode as unknown as VersionedNodeType,
  DLQReplayerNode as unknown as VersionedNodeType,
];

export const credentials = [OpsKitRedisApi];
