import { create, all, ConfigOptions } from 'mathjs';
import { Plugin, PluginContext, PluginResult } from '../types/plugin.types';

interface MathResult {
  expression: string;
  result: string | number;
  type: string;
  isValid: boolean;
  steps?: string[];
}

export class MathPlugin implements Plugin {
  name = 'math';
  description = 'Evaluates mathematical expressions and solves math problems';
  version = '1.0.0';

  private math: any;

  constructor() {
    // Create a mathjs instance with restricted configuration for security
    this.math = create(all);
    
    // Remove potentially dangerous functions
    this.math.import({
      'import': function () { throw new Error('Function import is disabled') },
      'createUnit': function () { throw new Error('Function createUnit is disabled') }
    }, { override: true });
  }

  /**
   * Check if this plugin can handle the given context
   */
  canHandle(context: PluginContext): boolean {
    const query = context.query.toLowerCase();
    
    const mathKeywords = [
      'calculate', 'compute', 'solve', 'math', 'equation', 'formula',
      'add', 'subtract', 'multiply', 'divide', 'square', 'sqrt', 'root',
      'sum', 'average', 'mean', 'percentage', 'percent'
    ];

    const mathPatterns = [
      /\d+\s*[\+\-\*\/\^]\s*\d+/,           // Simple arithmetic: 5 + 3
      /\d+\s*[\+\-\*\/]\s*\d+\s*[\+\-\*\/]\s*\d+/, // Complex: 5 + 3 * 2
      /sqrt\s*\(\s*\d+\s*\)/i,              // sqrt(16)
      /\d+\s*\^\s*\d+/,                     // 2^3
      /sin\s*\(\s*\d+\s*\)/i,               // sin(30)
      /cos\s*\(\s*\d+\s*\)/i,               // cos(60)
      /tan\s*\(\s*\d+\s*\)/i,               // tan(45)
      /log\s*\(\s*\d+\s*\)/i,               // log(10)
      /what\s+is\s+\d+.*[\+\-\*\/]/i,       // "what is 5 + 3"
      /calculate\s+\d+/i,                   // "calculate 2^3"
      /solve\s+.+=/i                        // "solve x = 2 + 3"
    ];

    const hasKeyword = mathKeywords.some(keyword => query.includes(keyword));
    const hasPattern = mathPatterns.some(pattern => pattern.test(context.query));
    const hasMathExpression = this.containsMathExpression(context.query);

    return hasKeyword || hasPattern || hasMathExpression;
  }

  /**
   * Execute the math plugin
   */
  async execute(context: PluginContext): Promise<PluginResult> {
    try {
      console.log(`🔢 Math plugin executing for query: "${context.query}"`);

      // Extract and clean the mathematical expression
      const expression = this.extractMathExpression(context.query);
      
      if (!expression) {
        return {
          success: false,
          error: 'Could not extract a valid mathematical expression',
          formattedResponse: 'I couldn\'t find a mathematical expression to solve. Please provide a clear math problem like "calculate 2 + 3" or "what is 5 * 7".'
        };
      }

      // Validate the expression for security
      if (!this.isExpressionSafe(expression)) {
        return {
          success: false,
          error: 'Mathematical expression contains unsafe elements',
          formattedResponse: 'I can only solve basic mathematical expressions. Please avoid using complex functions or variables.'
        };
      }

      // Evaluate the expression
      const result = await this.evaluateExpression(expression);
      
      if (!result.isValid) {
        return {
          success: false,
          error: 'Invalid mathematical expression',
          formattedResponse: `I couldn't solve "${expression}". Please check your math expression and try again.`
        };
      }

      // Format the response
      const formattedResponse = this.formatMathResponse(result);

      return {
        success: true,
        data: result,
        formattedResponse,
        metadata: {
          originalQuery: context.query,
          extractedExpression: expression,
          resultType: result.type
        }
      };

    } catch (error) {
      console.error('Math plugin error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown math calculation error',
        formattedResponse: 'Sorry, I encountered an error while solving the math problem. Please try a simpler expression.'
      };
    }
  }

  /**
   * Health check for math plugin
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple calculation
      const testResult = this.math.evaluate('2 + 2');
      return testResult === 4;
    } catch (error) {
      console.error('Math plugin health check failed:', error);
      return false;
    }
  }

  /**
   * Check if query contains mathematical expressions
   */
  private containsMathExpression(query: string): boolean {
    // Look for numbers with operators
    const mathPattern = /\d+\s*[\+\-\*\/\^%]\s*\d+/;
    return mathPattern.test(query);
  }

  /**
   * Extract mathematical expression from query
   */
  private extractMathExpression(query: string): string | null {
    // Remove common words and extract the math part
    let cleaned = query
      .toLowerCase()
      .replace(/what\s+(is|are)\s+/gi, '')
      .replace(/calculate\s+/gi, '')
      .replace(/compute\s+/gi, '')
      .replace(/solve\s+/gi, '')
      .replace(/\?/g, '')
      .trim();

    // Look for expressions with operators
    const patterns = [
      /(\d+(?:\.\d+)?\s*[\+\-\*\/\^%]\s*\d+(?:\.\d+)?(?:\s*[\+\-\*\/\^%]\s*\d+(?:\.\d+)?)*)/,
      /(sqrt\s*\(\s*\d+(?:\.\d+)?\s*\))/i,
      /(sin|cos|tan|log)\s*\(\s*\d+(?:\.\d+)?\s*\)/i,
      /(\d+(?:\.\d+)?\s*\^\s*\d+(?:\.\d+)?)/
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return match[1].replace(/\s+/g, ' ').trim();
      }
    }

    // If no pattern matches, try to find any sequence with numbers and operators
    const generalPattern = /[\d\+\-\*\/\^\(\)\.\s]+/;
    const match = cleaned.match(generalPattern);
    
    if (match && match[0].includes('+') || match && match[0].includes('-') || 
        match && match[0].includes('*') || match && match[0].includes('/')) {
      return match[0].trim();
    }

    return null;
  }

  /**
   * Check if expression is safe to evaluate
   */
  private isExpressionSafe(expression: string): boolean {
    // List of dangerous patterns/functions to avoid
    const dangerousPatterns = [
      /import/i,
      /require/i,
      /eval/i,
      /function/i,
      /while/i,
      /for/i,
      /if/i,
      /[a-zA-Z_][a-zA-Z0-9_]*\s*=/,  // Variable assignment
      /[{}]/,                         // Code blocks
      /[;]/                          // Multiple statements
    ];

    return !dangerousPatterns.some(pattern => pattern.test(expression));
  }

  /**
   * Evaluate mathematical expression safely
   */
  private async evaluateExpression(expression: string): Promise<MathResult> {
    try {
      const result = this.math.evaluate(expression);
      
      let resultType = 'number';
      let formattedResult: string | number = result;

      if (typeof result === 'number') {
        // Round to reasonable precision
        if (result % 1 !== 0) {
          formattedResult = Math.round(result * 1000000) / 1000000;
        }
        resultType = Number.isInteger(formattedResult) ? 'integer' : 'decimal';
      } else if (typeof result === 'string') {
        resultType = 'string';
        formattedResult = result;
      } else {
        resultType = 'complex';
        formattedResult = result.toString();
      }

      return {
        expression,
        result: formattedResult,
        type: resultType,
        isValid: true
      };

    } catch (error) {
      console.error('Math evaluation error:', error);
      return {
        expression,
        result: 'Error',
        type: 'error',
        isValid: false
      };
    }
  }

  /**
   * Format math response for user
   */
  private formatMathResponse(result: MathResult): string {
    const { expression, result: answer, type } = result;

    let typeDescription = '';
    switch (type) {
      case 'integer':
        typeDescription = '(whole number)';
        break;
      case 'decimal':
        typeDescription = '(decimal)';
        break;
      case 'complex':
        typeDescription = '(complex result)';
        break;
      default:
        typeDescription = '';
    }

    const response = `🔢 **Math Calculation**

📝 **Expression**: \`${expression}\`
✅ **Result**: **${answer}** ${typeDescription}

*Calculation performed using MathJS*`;

    return response;
  }
}
