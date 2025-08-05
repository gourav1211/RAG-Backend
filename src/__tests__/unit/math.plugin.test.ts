import { MathPlugin } from '../../plugins/math.plugin';
import { PluginContext } from '../../types/plugin.types';

describe('MathPlugin', () => {
  let mathPlugin: MathPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    mathPlugin = new MathPlugin();
    mockContext = {
      query: 'Test query',
      sessionId: 'test-session',
      userMessage: 'Test message',
      timestamp: new Date().toISOString()
    };
  });

  describe('canHandle', () => {
    it('should return true for basic math expressions', () => {
      const mathQueries = [
        'what is 2 + 2?',
        'calculate 10 * 5',
        'solve 15 / 3',
        'compute 100 - 25',
        'what is the square root of 16?',
        'calculate sin(30)',
        'what is 2^3?'
      ];

      mathQueries.forEach(query => {
        const context = { ...mockContext, query };
        expect(mathPlugin.canHandle(context)).toBe(true);
      });
    });

    it('should return true for complex math expressions', () => {
      const complexQueries = [
        'calculate the percentage increase from 100 to 150',
        'what is 25% of 200?',
        'solve: (2 + 3) * 4',
        'calculate average of 10, 20, 30',
        'what is the factorial of 5?'
      ];

      complexQueries.forEach(query => {
        const context = { ...mockContext, query };
        expect(mathPlugin.canHandle(context)).toBe(true);
      });
    });

    it('should return false for non-math queries', () => {
      const nonMathQueries = [
        'what is the weather like?',
        'tell me about TypeScript',
        'how to create a REST API?',
        'hello world',
        'what time is it?'
      ];

      nonMathQueries.forEach(query => {
        const context = { ...mockContext, query };
        expect(mathPlugin.canHandle(context)).toBe(false);
      });
    });

    it('should return false for edge cases', () => {
      expect(mathPlugin.canHandle({ ...mockContext, query: '' })).toBe(false);
      expect(mathPlugin.canHandle({ ...mockContext, query: '   ' })).toBe(false);
      expect(mathPlugin.canHandle({ ...mockContext, query: 'math' })).toBe(false); // Just the keyword
    });
  });

  describe('execute', () => {
    it('should solve basic arithmetic operations', async () => {
      const testCases = [
        { query: 'what is 2 + 2?', expectedResult: 4 },
        { query: 'calculate 10 * 5', expectedResult: 50 },
        { query: 'solve 15 / 3', expectedResult: 5 },
        { query: 'compute 100 - 25', expectedResult: 75 }
      ];

      for (const testCase of testCases) {
        const context = { ...mockContext, query: testCase.query };
        const result = await mathPlugin.execute(context);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.result).toBe(testCase.expectedResult);
        expect(result.data.expression).toBeDefined();
        expect(result.formattedResponse).toContain('Math Calculation');
      }
    });

    it('should handle mathematical functions', async () => {
      const context = { ...mockContext, query: 'what is sqrt(16)?' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(4);
    });

    it('should handle complex expressions with parentheses', async () => {
      const context = { ...mockContext, query: 'solve (2 + 3) * 4' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(20);
    });

    it('should handle invalid mathematical expressions', async () => {
      const invalidExpressions = [
        'calculate 1 / 0',
        'solve undefined_function(5)',
        'what is abc + def?'
      ];

      for (const expr of invalidExpressions) {
        const context = { ...mockContext, query: expr };
        const result = await mathPlugin.execute(context);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should provide formatted output', async () => {
      const context = { ...mockContext, query: 'what is 2.5 * 4.2?' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(10.5);
      expect(result.data.expression).toBe('2.5 * 4.2');
      expect(result.formattedResponse).toContain('2.5 * 4.2');
      expect(result.formattedResponse).toContain('10.5');
    });

    it('should handle queries with natural language', async () => {
      const context = { ...mockContext, query: 'I need to calculate 15 + 27 for my budget' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(42);
    });

    it('should return metadata with execution details', async () => {
      const context = { ...mockContext, query: 'calculate 7 * 8' };
      const result = await mathPlugin.execute(context);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.originalQuery).toBe('calculate 7 * 8');
      expect(result.metadata!.extractedExpression).toBeDefined();
    });

    it('should handle queries without math expressions', async () => {
      const context = { ...mockContext, query: 'hello world' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not extract a valid mathematical expression');
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy plugin', async () => {
      const isHealthy = await mathPlugin.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('plugin properties', () => {
    it('should have correct plugin information', () => {
      expect(mathPlugin.name).toBe('math');
      expect(mathPlugin.version).toBe('1.0.0');
      expect(mathPlugin.description).toContain('mathematical');
    });
  });

  describe('error handling', () => {
    it('should handle division by zero gracefully', async () => {
      const context = { ...mockContext, query: 'what is 5 / 0?' };
      const result = await mathPlugin.execute(context);
      
      // Note: JavaScript returns Infinity for division by zero, not an error
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(Infinity);
    });

    it('should handle syntax errors in expressions', async () => {
      const context = { ...mockContext, query: 'calculate 2 +* 3' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty or malformed queries', async () => {
      const malformedQueries = ['', '   ', 'calculate', 'what is?'];
      
      for (const query of malformedQueries) {
        const context = { ...mockContext, query };
        const result = await mathPlugin.execute(context);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', async () => {
      const context = { ...mockContext, query: 'calculate 999999 * 999999' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(typeof result.data.result).toBe('number');
    });

    it('should handle decimal precision', async () => {
      const context = { ...mockContext, query: 'what is 0.1 + 0.2?' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(0.3, 5);
    });

    it('should handle scientific notation', async () => {
      const context = { ...mockContext, query: 'calculate 1e6 / 1e3' };
      const result = await mathPlugin.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(1000);
    });
  });
});
