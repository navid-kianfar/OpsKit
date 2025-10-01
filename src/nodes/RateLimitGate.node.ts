import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getRedis } from '../shared/redis';
import { loadScript, LUA_TOKEN_BUCKET } from '../shared/lua';
import { nowMs } from '../shared/utils';
import { metric } from '../shared/metrics';

export class RateLimitGate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: RateLimit Gate',
    name: 'opsKitRateLimitGate',
    group: ['transform'],
    icon: 'fa:traffic-light',
    version: 1,
    description: 'Global distributed rate limiter',
    defaults: { name: 'RateLimit Gate' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { displayName: 'Policy Key', name: 'policyKey', type: 'string', default: 'openai:{{ $json.orgId }}' },
      { displayName: 'Capacity (tokens)', name: 'capacity', type: 'number', default: 60 },
      { displayName: 'Refill (tokens/sec)', name: 'refillRate', type: 'number', default: 1 },
      { displayName: 'Cost per item', name: 'cost', type: 'number', default: 1 },
      { displayName: 'TTL', name: 'ttlSec', type: 'number', default: 3600, description: 'Key TTL to avoid Redis bloat' },
      {
        displayName: 'On Limit',
        name: 'onLimit',
        type: 'options',
        options: [
          { name: 'Wait', value: 'wait' },
          { name: 'Fail (route to error)', value: 'fail' }
        ],
        default: 'wait'
      },
      { displayName: 'Max Wait (ms)', name: 'maxWaitMs', type: 'number', default: 15000 }
    ],
    credentials: [{ name: 'opsKitRedisApi', required: true }],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const { client, prefix } = await getRedis(this);
    const bucket = await loadScript(client, LUA_TOKEN_BUCKET);

    const out: INodeExecutionData[] = [];
    for (let i = 0; i < items.length; i++) {
      const policyKey = this.getNodeParameter('policyKey', i) as string;
      const capacity = this.getNodeParameter('capacity', i) as number;
      const refillRate = this.getNodeParameter('refillRate', i) as number;
      const cost = this.getNodeParameter('cost', i) as number;
      const ttlSec = this.getNodeParameter('ttlSec', i) as number;
      const onLimit = this.getNodeParameter('onLimit', i) as 'wait'|'fail';
      const maxWaitMs = this.getNodeParameter('maxWaitMs', i) as number;

      const key = `${prefix}ratelimit:${this.evaluateExpression(policyKey, i)}`;
      let allowed = 0;
      let remaining = 0;
      let start = nowMs();

      while (true) {
        const res = await bucket([key], [String(capacity), String(refillRate), String(nowMs()), String(cost), String(ttlSec)]) as unknown as [number, number, number];
        allowed = res[0]; remaining = Math.floor((res as any)[1]);
        if (allowed === 1) break;
        if (onLimit === 'fail') throw new Error(`Rate limit exceeded for ${policyKey}`);
        if (nowMs() - start > maxWaitMs) throw new Error(`Rate limit wait exceeded (${maxWaitMs}ms) for ${policyKey}`);
        await new Promise(r => setTimeout(r, 250));
      }

      metric('ratelimit_allow', { key: policyKey, remaining });

      out.push({ json: { ...items[i].json, ratelimit: { remaining } }, binary: items[i].binary });
    }

    await client.quit().catch(() => {});
    return [out];
  }
}
