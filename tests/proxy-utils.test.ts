/**
 * @jest-environment node
 * 
 * Tests for image proxy utilities, replacing scripts/test-unpack.js and scripts/test-unpack-cases.js
 */

import { unwrapProxiedUrl, isAlreadyProxied } from 'src/libs/utils/image/proxyUtils'
import { customMapImageUrl } from 'src/libs/utils/notion/customMapImageUrl'

describe('isAlreadyProxied', () => {
  it('should detect already proxied url', () => {
    const url = '/api/image-proxy?url=https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fimage.png'
    expect(isAlreadyProxied(url)).toBe(true)
  })
})

describe('customMapImageUrl', () => {
  it('should NOT wrap already proxied URL', () => {
    const url = '/api/image-proxy?url=https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fimage.png%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Signature%3D123'
    
    // It should return the URL as is, because it's already proxied
    const result = customMapImageUrl(url)
    expect(result).toBe(url)
  })
})

describe('unwrapProxiedUrl', () => {
  const cases = [
    {
      name: 'nested-s3-sample',
      input: "%2Fapi%2Fimage-proxy%3Furl%3Dhttps%253A%252F%252Fprod-files-secure.s3.us-west-2.amazonaws.com%252Fda63dd0f-9bae-4c9d-a318-bd0705ed73e2%252F890470fe-bb50-4322-98d2-db52e89b2fa3%252Fimage.png%253FX-Amz-Algorithm%253DAWS4-HMAC-SHA256",
      asserts: (out: string) => out.startsWith('https://') && out.includes('amazonaws.com') && out.includes('X-Amz-Algorithm')
    },
    {
      name: 'double-proxy-example-com',
      input: '%2Fapi%2Fimage-proxy%3Furl%3Dhttps%3A%2F%2Fexample.com%2Fimg.png',
      asserts: (out: string) => out === 'https://example.com/img.png'
    },
    {
      name: 'encoded-query-params',
      input: '%2Fapi%2Fimage-proxy%3Furl%3Dhttps%253A%252F%252Fexample.com%252Fimg.png%253Fparam%253Da%2526b%253Dc',
      asserts: (out: string) => out.startsWith('https://example.com/img.png') && out.includes('param=a') && out.includes('b=c')
    }
  ]

  cases.forEach((c) => {
    it(`should correctly unwrap: ${c.name}`, () => {
      const out = unwrapProxiedUrl(c.input)
      const ok = c.asserts(out)
      if (!ok) {
        console.log(`FAIL ${c.name}\n  input: ${c.input}\n  output: ${out}`)
      }
      expect(ok).toBe(true)
    })
  })

  // Additional test case from test-unpack.js
  it('should handle complex nested proxy url from test-unpack.js', () => {
    const input = "%2Fapi%2Fimage-proxy%3Furl%3Dhttps%253A%252F%252Fprod-files-secure.s3.us-west-2.amazonaws.com%252Fda63dd0f-9bae-4c9d-a318-bd0705ed73e2%252F890470fe-bb50-4322-98d2-db52e89b2fa3%252Fimage.png%253FX-Amz-Algorithm%253DAWS4-HMAC-SHA256"
    const output = unwrapProxiedUrl(input)
    expect(output).toMatch(/^https:\/\//)
    expect(output).toContain('amazonaws.com')
  })
})
