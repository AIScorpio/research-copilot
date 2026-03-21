import 'groq-sdk/shims/node'

global.fetch = jest.fn()

// Use file-based SQLite for tests
process.env.DATABASE_URL = 'file:./test.db'