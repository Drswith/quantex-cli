interface ParsedVersion {
  core: [bigint, bigint, bigint]
  prerelease: string[]
}

export function compareVersions(left: string, right: string): number | undefined {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)

  if (!leftVersion || !rightVersion) return undefined

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftVersion.core[index]!
    const rightPart = rightVersion.core[index]!
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1
  }

  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease)
}

function parseVersion(value: string): ParsedVersion | undefined {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?$/iu)
  if (!match) return undefined

  return {
    core: [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!)],
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1

  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]

    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftNumeric = /^\d+$/u.test(leftPart)
    const rightNumeric = /^\d+$/u.test(rightPart)

    if (leftNumeric && rightNumeric) {
      const leftNumber = BigInt(leftPart)
      const rightNumber = BigInt(rightPart)
      if (leftNumber === rightNumber) continue
      return leftNumber > rightNumber ? 1 : -1
    }
    if (leftNumeric) return -1
    if (rightNumeric) return 1

    return leftPart > rightPart ? 1 : -1
  }

  return 0
}
