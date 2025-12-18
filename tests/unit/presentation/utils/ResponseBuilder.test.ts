import { ResponseBuilder } from '../../../../src/presentation/utils/ResponseBuilder';

describe('ResponseBuilder', () => {
  describe('ok', () => {
    it('should return 200 status with data', () => {
      const data = { id: '123', name: 'Test' };
      const response = ResponseBuilder.ok(data);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });

    it('should include pagination metadata when provided', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination = {
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasMore: true,
      };

      const response = ResponseBuilder.ok(data, { pagination });
      const body = JSON.parse(response.body);

      expect(body.pagination).toEqual(pagination);
    });

    it('should include stats metadata when provided', () => {
      const data = { items: [] };
      const stats = { totalCreated: 10, totalFailed: 2 };

      const response = ResponseBuilder.ok(data, { stats });
      const body = JSON.parse(response.body);

      expect(body.stats).toEqual(stats);
    });
  });

  describe('created', () => {
    it('should return 201 status with data and default message', () => {
      const data = { id: '123' };
      const response = ResponseBuilder.created(data);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.message).toBe('Resource created successfully');
    });

    it('should use custom message when provided', () => {
      const data = { id: '123' };
      const message = 'Category created';
      const response = ResponseBuilder.created(data, message);

      const body = JSON.parse(response.body);
      expect(body.message).toBe(message);
    });
  });

  describe('noContent', () => {
    it('should return 204 status with empty body', () => {
      const response = ResponseBuilder.noContent();

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });
  });

  describe('badRequest', () => {
    it('should return 400 status with error message', () => {
      const message = 'Invalid input';
      const response = ResponseBuilder.badRequest(message);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe(message);
    });

    it('should include validation errors when provided', () => {
      const message = 'Validation failed';
      const errors = { email: 'Invalid email format' };
      const response = ResponseBuilder.badRequest(message, errors);

      const body = JSON.parse(response.body);
      expect(body.error.details).toEqual(errors);
    });
  });

  describe('unauthorized', () => {
    it('should return 401 status with default message', () => {
      const response = ResponseBuilder.unauthorized();

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
    });

    it('should use custom message when provided', () => {
      const message = 'Invalid token';
      const response = ResponseBuilder.unauthorized(message);

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe(message);
    });
  });

  describe('forbidden', () => {
    it('should return 403 status with default message', () => {
      const response = ResponseBuilder.forbidden();

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Access denied');
    });

    it('should use custom message when provided', () => {
      const message = 'Insufficient permissions';
      const response = ResponseBuilder.forbidden(message);

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe(message);
    });
  });

  describe('notFound', () => {
    it('should return 404 status with default message', () => {
      const response = ResponseBuilder.notFound();

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Resource not found');
    });

    it('should include resource name when provided', () => {
      const resource = 'Category';
      const response = ResponseBuilder.notFound(resource);

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe('Category not found');
    });
  });

  describe('conflict', () => {
    it('should return 409 status with message and default code', () => {
      const message = 'Resource already exists';
      const response = ResponseBuilder.conflict(message);

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toBe(message);
    });

    it('should use custom error code when provided', () => {
      const message = 'Cannot delete category with transactions';
      const code = 'HAS_DEPENDENT_RECORDS';
      const response = ResponseBuilder.conflict(message, code);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(code);
    });
  });

  describe('internalError', () => {
    it('should return 500 status with default message', () => {
      const response = ResponseBuilder.internalError();

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should include custom message and requestId', () => {
      const message = 'Database connection failed';
      const requestId = 'req-123';
      const response = ResponseBuilder.internalError(message, requestId);

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe(message);
      expect(body.error.requestId).toBe(requestId);
    });
  });

  describe('custom', () => {
    it('should return custom status code and body', () => {
      const statusCode = 418;
      const body = { message: "I'm a teapot" };
      const response = ResponseBuilder.custom(statusCode, body);

      expect(response.statusCode).toBe(418);
      expect(JSON.parse(response.body)).toEqual(body);
    });
  });
});
