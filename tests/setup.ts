/**
 * Jest Test Setup
 * Runs before all tests to configure the test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(), // Mock console.log
  debug: jest.fn(), // Mock console.debug
  info: jest.fn(), // Mock console.info
  warn: jest.fn(), // Mock console.warn
  error: jest.fn(), // Mock console.error but keep original for debugging if needed
};

// Mock AWS Lambda Context (if needed for integration tests)
export const mockContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2025/12/17/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

// Mock Supabase client (basic structure - will be expanded in integration tests)
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  auth: {
    getUser: jest.fn(),
  },
};

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
