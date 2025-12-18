import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { handler } from '../create-transaction';
import { TransactionFrequencyEnum } from '../../../enums/transaction';

// Mock das dependências
jest.mock('../../../libs/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../../utils/rrule-converter', () => ({
  convertToRRule: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

import { supabase } from '../../../libs/supabase';
import { convertToRRule } from '../../../utils/rrule-converter';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockConvertToRRule = convertToRRule as jest.MockedFunction<
  typeof convertToRRule
>;

describe('create-transaction handler', () => {
  let mockEvent: any;
  let mockFrom: any;
  let mockInsert: any;
  let mockSelect: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup dos mocks
    mockSelect = jest.fn();
    mockInsert = jest.fn();
    mockFrom = jest.fn();

    mockInsert.mockReturnValue({
      select: mockSelect,
    });

    mockFrom.mockReturnValue({
      insert: mockInsert,
    });

    mockSupabase.from = mockFrom;

    // Setup do evento mock
    mockEvent = {
      body: JSON.stringify({
        description: 'Test transaction',
        date: '2024-01-15T10:00:00Z',
        amount: 100.5,
        type: 'income',
        categoryId: 'cat-123',
        tagId: 'tag-456',
        note: 'Test note',
        paymentStatusId: 'status-789',
      }),
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'user-123',
            },
            scopes: [],
          },
          principalId: 'user-123',
          integrationLatency: 0,
        },
      },
    };
  });

  describe('Validação de entrada', () => {
    it('deve retornar erro 400 quando dados inválidos são fornecidos', async () => {
      mockEvent.body = JSON.stringify({
        description: '', // Descrição vazia
        amount: 'invalid', // Amount inválido
        type: 'invalid-type', // Tipo inválido
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Invalid data',
      });
    });

    it('deve retornar erro 400 quando body está vazio', async () => {
      mockEvent.body = '';

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Invalid data',
      });
    });

    it('deve aceitar dados válidos sem campos opcionais', async () => {
      mockEvent.body = JSON.stringify({
        description: 'Simple transaction',
        date: '2024-01-15T10:00:00Z',
        amount: 50,
        type: 'outcome',
      });

      mockSelect.mockResolvedValue({
        data: [{ id: 'mock-uuid-123', description: 'Simple transaction' }],
        error: null,
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(201);
      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });
  });

  describe('Criação de transação simples', () => {
    it('deve criar uma transação simples com sucesso', async () => {
      mockSelect.mockResolvedValue({
        data: [{ id: 'mock-uuid-123', description: 'Test transaction' }],
        error: null,
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Transaction created successfully',
        data: [{ id: 'mock-uuid-123', description: 'Test transaction' }],
      });

      // Verifica se o insert foi chamado com os dados corretos
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid-123',
          description: 'Test transaction',
          amount: 100.5,
          type: 'income',
          category_id: 'cat-123',
          tag_id: 'tag-456',
          note: 'Test note',
          user_id: 'user-123',
          payment_status_id: 'status-789',
        })
      );
    });

    it('deve retornar erro 500 quando há erro no banco de dados', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Error creating transaction',
        error: 'Database connection failed',
      });
    });
  });

  describe('Criação de transação recorrente', () => {
    beforeEach(() => {
      mockEvent.body = JSON.stringify({
        description: 'Recurring transaction',
        date: '2024-01-15T10:00:00Z',
        amount: 200,
        type: 'outcome',
        recurrent: {
          frequency: TransactionFrequencyEnum.MONTHLY,
          quantity: 12,
        },
      });

      mockConvertToRRule.mockReturnValue('FREQ=MONTHLY;COUNT=12');
    });

    it('deve criar uma transação recorrente com sucesso', async () => {
      // Mock para recurring_transactions
      const mockRecurringSelect = jest.fn() as any;
      mockRecurringSelect.mockResolvedValue({
        data: [{ id: 'recurring-123' }],
        error: null,
      });

      // Mock para transactions
      const mockTransactionSelect = jest.fn() as any;
      mockTransactionSelect.mockResolvedValue({
        data: [{ id: 'mock-uuid-123', description: 'Recurring transaction' }],
        error: null,
      });

      mockFrom
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: mockRecurringSelect,
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: mockTransactionSelect,
          }),
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(201);
      expect(mockConvertToRRule).toHaveBeenCalledWith(
        TransactionFrequencyEnum.MONTHLY,
        12
      );

      // Verifica se foi chamado para criar recurring_transaction
      expect(mockFrom).toHaveBeenCalledWith('recurring_transactions');
      // Verifica se foi chamado para criar transaction
      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('deve retornar erro 400 quando falha ao criar transação recorrente', async () => {
      const mockRecurringSelect = jest.fn() as any;
      mockRecurringSelect.mockResolvedValue({
        data: null,
        error: { message: 'Failed to create recurring transaction' },
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: mockRecurringSelect,
        }),
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Error creating recurring transaction',
        error: { message: 'Failed to create recurring transaction' },
      });
    });
  });

  describe('Tratamento de erros', () => {
    it('deve retornar erro 500 quando ocorre exceção inesperada', async () => {
      mockEvent.body = JSON.stringify({
        description: 'Test transaction',
        date: '2024-01-15T10:00:00Z',
        amount: 100,
        type: 'income',
      });

      // Simula erro inesperado
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Internal server error',
        error: 'Unexpected error',
      });
    });

    it('deve lidar com erro não sendo uma instância de Error', async () => {
      mockEvent.body = JSON.stringify({
        description: 'Test transaction',
        date: '2024-01-15T10:00:00Z',
        amount: 100,
        type: 'income',
      });

      // Simula erro que não é uma instância de Error
      mockFrom.mockImplementation(() => {
        throw 'String error';
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Internal server error',
        error: 'Unknown error',
      });
    });
  });
});
