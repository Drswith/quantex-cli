import { afterEach } from 'vitest'
import { resetCliContext } from '../src/cli-context'

afterEach(() => {
  resetCliContext()
})
