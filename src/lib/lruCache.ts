/** Small bounded caches: reading an entry makes it the most recently used. */
export class LruCache<K, V> extends Map<K, V> {
  constructor(private readonly limit: number) {
    super()
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Cache limit must be positive')
  }

  override get(key: K): V | undefined {
    if (!super.has(key)) return undefined
    const value = super.get(key)!
    super.delete(key)
    super.set(key, value)
    return value
  }

  override set(key: K, value: V): this {
    super.delete(key)
    super.set(key, value)
    if (this.size > this.limit) super.delete(this.keys().next().value!)
    return this
  }
}
