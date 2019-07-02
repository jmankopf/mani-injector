module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/', '<rootDir>/tests/'],
    collectCoverage: false,
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}'
    ],
    globals: {
        "ts-jest": {
            tsConfig: "tests/tsconfig.json"
        }
    }
};
