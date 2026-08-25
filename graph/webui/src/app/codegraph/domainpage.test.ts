import { describe, expect, it } from 'vitest'
import {
  DOMAIN_CASCADE_DEPTH,
  DOMAIN_FOCUS_QUOTA,
  DOMAIN_LEVEL_NODE_LIMIT,
  DOMAIN_SHARED_CALLER_DOMAINS,
} from './domainpage'

describe('C1.10 domain page frozen thresholds', () => {
  it('pins the cascade depth to 3', () => {
    expect(DOMAIN_CASCADE_DEPTH).toBe(3)
  })

  it('pins the focus quota to 5', () => {
    expect(DOMAIN_FOCUS_QUOTA).toBe(5)
  })

  it('pins the per-level node limit to 8', () => {
    expect(DOMAIN_LEVEL_NODE_LIMIT).toBe(8)
  })

  it('pins shared caller domains to K=3', () => {
    expect(DOMAIN_SHARED_CALLER_DOMAINS).toBe(3)
  })
})
