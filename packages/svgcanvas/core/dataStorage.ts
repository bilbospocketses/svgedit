/**
 * A storage solution aimed at replacing jQuery's data function.
 * Implementation Note: Elements are stored in a [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap).
 * This makes sure the data is garbage collected when the node is removed.
 *
 * @module dataStorage
 * @license MIT
 */
class DataStorage {
  readonly #storage = new WeakMap<object, Map<string, unknown>>()

  /** Checks if the provided element is a valid WeakMap key. */
  readonly #isValidKey = (element: unknown): element is object => {
    return element !== null && (typeof element === 'object' || typeof element === 'function')
  }

  /** Stores data associated with an element. */
  put (element: unknown, key: string, obj: unknown): void {
    if (!this.#isValidKey(element)) {
      return
    }
    let elementMap = this.#storage.get(element)
    if (!elementMap) {
      elementMap = new Map<string, unknown>()
      this.#storage.set(element, elementMap)
    }
    elementMap.set(key, obj)
  }

  /** Retrieves data associated with an element. */
  get (element: unknown, key: string): unknown {
    if (!this.#isValidKey(element)) {
      return undefined
    }
    return this.#storage.get(element)?.get(key)
  }

  /** Checks if an element has data stored under a specific key. */
  has (element: unknown, key: string): boolean {
    if (!this.#isValidKey(element)) {
      return false
    }
    return this.#storage.get(element)?.has(key) === true
  }

  /** Removes data associated with an element. */
  remove (element: unknown, key: string): boolean {
    if (!this.#isValidKey(element)) {
      return false
    }
    const elementMap = this.#storage.get(element)
    if (!elementMap) {
      return false
    }
    const ret = elementMap.delete(key)
    if (elementMap.size === 0) {
      this.#storage.delete(element)
    }
    return ret
  }
}

// Export singleton instance for backward compatibility
const dataStorage: DataStorage = new DataStorage()
export default dataStorage
