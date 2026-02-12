import { describe, it, expect, vi } from 'vitest'
import { cn, fileToDataURI } from './utils'

describe('cn', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    const result = cn('foo', false && 'bar', 'baz')
    expect(result).toBe('foo baz')
  })

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar'])
    expect(result).toBe('foo bar')
  })

  it('should handle objects', () => {
    const result = cn({ foo: true, bar: false })
    expect(result).toBe('foo')
  })
})

describe('fileToDataURI', () => {
  it('should convert file to data URI', async () => {
    const content = 'hello world'
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    
    const result = await fileToDataURI(file)
    
    expect(result).toContain('data:text/plain;base64,')
  })

  it('should handle empty file', async () => {
    const file = new File([], 'test.txt')
    
    const result = await fileToDataURI(file)
    
    expect(result).toContain('data:application/octet-stream;base64,')
  })
})
