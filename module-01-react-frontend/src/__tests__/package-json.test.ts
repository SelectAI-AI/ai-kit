// Feature: module-01-react-frontend, Property 3: package.json dependencies use exact version pins
// Validates: Requirements 1.2

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import packageJson from '../../package.json'

const pkg = packageJson as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const allDeps: Array<{ name: string; version: string; field: string }> = [
  ...Object.entries(pkg.dependencies ?? {}).map(([name, version]) => ({
    name, version, field: 'dependencies',
  })),
  ...Object.entries(pkg.devDependencies ?? {}).map(([name, version]) => ({
    name, version, field: 'devDependencies',
  })),
]

describe('package.json — exact version pins (Property 3)', () => {
  it('has at least one dependency entry to validate', () => {
    expect(allDeps.length).toBeGreaterThan(0)
  })

  it('every dependency version does not start with ^ or ~', () => {
    for (const { name, version, field } of allDeps) {
      expect(
        version.startsWith('^') || version.startsWith('~'),
        `${field}.${name} has a range specifier: "${version}" — expected an exact pin`,
      ).toBe(false)
    }
  })

  it('property: for any sampled dependency entry, the version is an exact pin (fast-check)', () => {
    // Build an arbitrary that picks one entry from the real dependency list
    const depArbitrary = fc.constantFrom(...allDeps)

    fc.assert(
      fc.property(depArbitrary, ({ name, version, field }) => {
        const isRanged = version.startsWith('^') || version.startsWith('~')
        if (isRanged) {
          throw new Error(
            `${field}.${name} uses a range specifier: "${version}" — expected an exact pin`,
          )
        }
        return true
      }),
      { numRuns: 100 },
    )
  })
})
