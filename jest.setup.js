import '@testing-library/jest-dom'

global.fetch = jest.fn()

process.env.DATABASE_URL = ':memory:'
