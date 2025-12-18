/**
 * Integration tests for get-category handler (MIGRATED)
 * Tests the handler with middleware integration
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

import { handler } from '../../../src/functions/category/get-category';
import { supabase } from '../../../src/libs/supabase';

// Mock Supabase
jest.mock('../../../src/libs/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('get-category handler (MIGRATED with middleware)', () => {
  const mockUserId = 'test-user-123';

  const createMockEvent = (overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent => {
    return {
      httpMethod: 'GET',
      path: '/categories',
      headers: {},
      body: null,
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      stageVariables: null,
      resource: '',
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api-id',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/categories',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '01/Jan/2025:00:00:00 +0000',
        requestTimeEpoch: 1704067200000,
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          apiKey: null,
          principalOrgId: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent: 'test-agent',
          user: null,
          sourceIp: '127.0.0.1',
          accessKey: null,
          clientCert: null,
        },
        authorizer: {
          jwt: {
            claims: {
              sub: mockUserId,
              email: 'test@example.com',
            },
            scopes: [],
          },
        },
        resourceId: '',
        resourcePath: '',
      },
      ...overrides,
    } as APIGatewayProxyEvent;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success cases', () => {
    it('should return 200 with categories when user has categories', async () => {
      const mockCategories = [
        { id: 'cat-1', description: 'Food', user_id: mockUserId, created_at: new Date() },
        { id: 'cat-2', description: 'Transport', user_id: mockUserId, created_at: new Date() },
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: mockCategories,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toMatchObject({
        id: 'cat-1',
        description: 'Food',
        user_id: mockUserId,
      });
      expect(body.data[1]).toMatchObject({
        id: 'cat-2',
        description: 'Transport',
        user_id: mockUserId,
      });

      // Verify Supabase was called correctly
      expect(supabase.from).toHaveBeenCalledWith('categories');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('user_id', mockUserId);
    });

    it('should return 200 with empty array when user has no categories', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('should return 200 with empty array when data is null', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  describe('Authentication', () => {
    it('should return 401 when userId is missing', async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                // sub missing
                email: 'test@example.com',
              },
              scopes: [],
            },
          },
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when userId is empty string', async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            jwt: {
              claims: {
                sub: '   ', // Empty/whitespace
                email: 'test@example.com',
              },
              scopes: [],
            },
          },
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Error handling', () => {
    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed');

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockRejectedValue(dbError);

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      const event = createMockEvent();
      const response = await handler(event);

      // errorMiddleware should catch and return error response
      expect(response.statusCode).toBeGreaterThanOrEqual(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it('should handle database error object from Supabase', async () => {
      // Supabase returns errors as { data, error } object, not thrown
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Duplicate key violation' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      const event = createMockEvent();
      const response = await handler(event);

      // Handler throws error when error object is present
      expect(response.statusCode).toBeGreaterThanOrEqual(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('Data isolation', () => {
    it('should only fetch categories for authenticated user', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      const event = createMockEvent();
      await handler(event);

      // Verify user_id filter is applied (security check)
      expect(mockEq).toHaveBeenCalledWith('user_id', mockUserId);
    });
  });
});
