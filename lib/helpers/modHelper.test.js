const { 
	canInvokeModCommands,
	isValidDelayValue,
	isValidCooldownValue,
	findPlayerByHeroName
} = require('./modHelper')

describe('canInvokeModCommands', () => {
	test ('disallows normal users', () => {
		expect(canInvokeModCommands('123', false, '456', ['999'])).toBe(false)
	})

	test('allows Global Mod', () => {
		expect(canInvokeModCommands('123', true, '456', [])).toBe(true)
	})

	test('allows broadcaster', () => {
		expect(canInvokeModCommands('123', false, '123', ['999'])).toBe(true)
	})

	test('allows 9kmmrbot mod', () => {
		expect(canInvokeModCommands('123', false, '456', ['999', '123'])).toBe(true)
	})
})

describe('isValidDelayValue', () => {
	test('disallows null and undefined', () => {
		expect(isValidDelayValue(null)).toBe(false)
		expect(isValidDelayValue(undefined)).toBe(false)
	})

	test('disallows non-numbers', () => {
		expect(isValidDelayValue('test_value')).toBe(false)
	})

	test('disallows negative values', () => {
		expect(isValidDelayValue(-100)).toBe(false)
	})

	test('disallows 0', () => {
		expect(isValidDelayValue(0)).toBe(false)
	})

	test('disallows greater than 10 minutes', () => {
		expect(isValidDelayValue(630)).toBe(false)
	})

	test('disallows numbers not divisible by 30', () => {
		expect(isValidDelayValue(301)).toBe(false)
	})

	test('allows boundary values', () => {
		expect(isValidDelayValue(30)).toBe(true)
		expect(isValidDelayValue(600)).toBe(true)
	})
 
	// Generates a random value in [30, 600], divisible by 30.
	const validDelay = 30 * (Math.floor(Math.random() * 20) + 1)
	test(`allows ${validDelay}`, () => {
		expect(isValidDelayValue(validDelay)).toBe(true)
	})
})

describe('isValidCooldownValue', () => {
	test('disallows null and undefined', () => {
		expect(isValidCooldownValue(null)).toBe(false)
		expect(isValidCooldownValue(undefined)).toBe(false)
	})

	test('disallows non-numbers', () => {
		expect(isValidCooldownValue('test_value')).toBe(false)
	})

	test('disallows negative values', () => {
		expect(isValidCooldownValue(-100)).toBe(false)
	})

	test('disallows 0', () => {
		expect(isValidCooldownValue(0)).toBe(false)
	})

	test('disallows greater than 5 minutes', () => {
		expect(isValidCooldownValue(330)).toBe(false)
	})

	test('allows boundary values', () => {
		expect(isValidCooldownValue(30)).toBe(true)
		expect(isValidCooldownValue(300)).toBe(true)
	})
 
	// Generates a random value in [30, 300].
	const validCooldown = Math.floor(Math.random() * (300 - 30 + 1)) + 30
	test(`allows ${validCooldown}`, () => {
		expect(isValidCooldownValue(validCooldown)).toBe(true)
	})
})

describe('findPlayerByHeroName', () => {
	const heroes = [
		{ id: 1, localized_name: 'Abaddon' },
		{ id: 2, localized_name: 'Anti-Mage' },
		{ id: 3, localized_name: 'Medusa' },
		{ id: 4, localized_name: 'Nyx Assassin' },
		{ id: 5, localized_name: 'Pudge' },
		{ id: 6, localized_name: 'Queen of Pain' },
		{ id: 7, localized_name: 'Storm Spirit' },
		{ id: 8, localized_name: 'Tidehunter' },
		{ id: 9, localized_name: 'Weaver' },
		{ id: 10, localized_name: 'Zeus' }
	]

	const players = [
		{ hero_id: 2 },
		{ hero_id: 4 },
		{ hero_id: 10 },
		{ hero_id: 1 },
		{ hero_id: 8 },
		{ hero_id: 3 },
		{ hero_id: 5 },
		{ hero_id: 7 },
		{ hero_id: 6 },
		{ hero_id: 9 },
	]

	const game = { players }

	test('finds a player from valid hero name', () => {
		expect(findPlayerByHeroName('queen of pain', game, heroes))
			.toEqual({
				hero: { id: 6, localized_name: 'Queen of Pain' },
				player: { hero_id: 6 }
			})
	})

	test('returns null for invalid hero name', () => {
		expect(findPlayerByHeroName('qop', game, heroes))
			.toBeNull()

		expect(findPlayerByHeroName('donkey kong', game, heroes))
			.toBeNull()
	})
})
