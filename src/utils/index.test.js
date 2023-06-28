import { validateName } from './'

test('validateName returns true for valid names', () => {
  expect(validateName('space')).toBe('space')
  expect(validateName('1️⃣2️⃣8️⃣9️⃣.bnb')).toBe('1⃣2⃣8⃣9⃣.bnb')
  expect(validateName('space-id.eth')).toBe('space-id.eth')
  expect(validateName('space-id.bnb')).toBe('space-id.bnb')
})

test('validateName returns false for invalid names', () => {
  expect(() => validateName('$space')).toThrowError('Invalid name')
  expect(() => validateName('#space')).toThrowError('Invalid name')
  expect(() => validateName('space ')).toThrowError('Invalid name')
})
