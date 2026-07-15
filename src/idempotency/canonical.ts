import { createHash } from 'node:crypto'

export type CanonicalValue = boolean | null | number | string | CanonicalValue[] | { [key: string]: CanonicalValue }

export interface CanonicalMutationRequest {
  readonly action: string
  readonly options: { readonly [key: string]: CanonicalValue }
  readonly targets: readonly string[]
}

export interface MutationRequestInput {
  readonly action: string
  readonly options?: Readonly<Record<string, unknown>>
  readonly targets: readonly string[]
}

export type PresentationRuntimeMetadata = Readonly<Record<string, unknown>>

export function canonicalizeMutationRequest(
  input: MutationRequestInput,
  _metadata: PresentationRuntimeMetadata = {},
): CanonicalMutationRequest {
  const options = canonicalizeValue(input.options ?? {})
  if (Array.isArray(options) || options === null || typeof options !== 'object') {
    throw new TypeError('Mutation options must be a JSON object.')
  }

  return {
    action: input.action,
    options,
    targets: [...new Set(input.targets)].sort(compareCodePoints),
  }
}

export function fingerprintCanonicalValue(value: unknown): string {
  return createHash('sha256')
    .update(stringifyCanonicalValue(canonicalizeValue(value)), 'utf8')
    .digest('hex')
}

function canonicalizeValue(value: unknown): CanonicalValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical numbers must be finite.')
    return value
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError('Canonical arrays must not contain sparse positions.')
      }
    }
    return value.map(canonicalizeValue)
  }
  if (typeof value !== 'object') throw new TypeError(`Unsupported canonical value: ${typeof value}`)

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Canonical objects must be plain JSON objects.')
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodePoints)
      .flatMap(key => {
        const childValue = (value as Record<string, unknown>)[key]
        return childValue === undefined ? [] : [[key, canonicalizeValue(childValue)]]
      }),
  )
}

function stringifyCanonicalValue(value: CanonicalValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stringifyCanonicalValue).join(',')}]`

  const entries = Object.keys(value)
    .sort(compareCodePoints)
    .map(key => `${JSON.stringify(key)}:${stringifyCanonicalValue(value[key]!)}`)
  return `{${entries.join(',')}}`
}

function compareCodePoints(left: string, right: string): number {
  const leftCodePoints = left[Symbol.iterator]()
  const rightCodePoints = right[Symbol.iterator]()

  while (true) {
    const leftNext = leftCodePoints.next()
    const rightNext = rightCodePoints.next()
    if (leftNext.done || rightNext.done) {
      if (leftNext.done === rightNext.done) return 0
      return leftNext.done ? -1 : 1
    }

    const difference = leftNext.value.codePointAt(0)! - rightNext.value.codePointAt(0)!
    if (difference !== 0) return difference
  }
}
