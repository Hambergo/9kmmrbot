const { canInvokeModCommands } = require('./modHelper')

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

