import { WeatherPlugin } from '../../plugins/weather.plugin';
import { PluginContext } from '../../types/plugin.types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherPlugin', () => {
  let weatherPlugin: WeatherPlugin;
  let mockContext: PluginContext;

  const mockGeocodingResponse = {
    data: {
      results: [{
        name: 'New York',
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'United States',
        admin1: 'New York'
      }]
    }
  };

  const mockWeatherResponse = {
    data: {
      current: {
        time: '2025-08-05T10:00',
        temperature_2m: 25.5,
        relative_humidity_2m: 65,
        wind_speed_10m: 12.5,
        wind_direction_10m: 180,
        weather_code: 1
      },
      units: {
        temperature_2m: '°C',
        wind_speed_10m: 'km/h'
      }
    }
  };

  beforeEach(() => {
    weatherPlugin = new WeatherPlugin();
    mockContext = {
      query: 'Test query',
      sessionId: 'test-session',
      userMessage: 'Test message',
      timestamp: new Date().toISOString()
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('canHandle', () => {
    it('should return true for weather-related queries', () => {
      const weatherQueries = [
        'what is the weather in New York?',
        'weather today',
        'current weather in London',
        'how is the weather in Tokyo?',
        'temperature in Paris',
        'weather forecast for Berlin',
        'is it raining in Seattle?',
        'what is the humidity like?'
      ];

      weatherQueries.forEach(query => {
        const context = { ...mockContext, query };
        expect(weatherPlugin.canHandle(context)).toBe(true);
      });
    });

    it('should return true for weather-related keywords', () => {
      const keywordQueries = [
        'check the temperature',
        'is it sunny today?',
        'wind conditions',
        'humidity levels',
        'storm warning',
        'cloudy weather',
        'snow forecast'
      ];

      keywordQueries.forEach(query => {
        const context = { ...mockContext, query };
        expect(weatherPlugin.canHandle(context)).toBe(true);
      });
    });

    it('should return false for non-weather queries', () => {
      const nonWeatherQueries = [
        'calculate 2 + 2',
        'what is TypeScript?',
        'how to create a REST API?',
        'hello world',
        'tell me a joke',
        'what time is it?',
        'how are you doing?'
      ];

      nonWeatherQueries.forEach(query => {
        const context = { ...mockContext, query };
        expect(weatherPlugin.canHandle(context)).toBe(false);
      });
    });

    it('should return false for edge cases', () => {
      expect(weatherPlugin.canHandle({ ...mockContext, query: '' })).toBe(false);
      expect(weatherPlugin.canHandle({ ...mockContext, query: '   ' })).toBe(false);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Setup default mocks for successful API calls
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve(mockGeocodingResponse);
        } else if (url.includes('api.open-meteo.com')) {
          return Promise.resolve(mockWeatherResponse);
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('should successfully get weather for a valid location', async () => {
      const context = { ...mockContext, query: 'what is the weather in New York?' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.formattedResponse).toContain('New York');
      expect(result.formattedResponse).toContain('25.5');
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.location).toBe('New York');
    });

    it('should handle location extraction from various query formats', async () => {
      const queries = [
        'weather in London',
        'what is the weather like in Tokyo?',
        'current temperature for Paris',
        'how is the weather in Berlin today?'
      ];

      for (const query of queries) {
        const context = { ...mockContext, query };
        const result = await weatherPlugin.execute(context);

        // Should attempt to make API calls (success depends on mock)
        expect(mockedAxios.get).toHaveBeenCalled();
      }
    });

    it('should handle queries without location', async () => {
      const context = { ...mockContext, query: 'what is the weather?' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not extract location');
      expect(result.formattedResponse).toContain('need a location');
    });

    it('should handle location not found', async () => {
      // Mock empty geocoding response
      mockedAxios.get.mockImplementationOnce(() => 
        Promise.resolve({ data: { results: [] } })
      );

      const context = { ...mockContext, query: 'weather in NonExistentCity' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.formattedResponse).toContain('couldn\'t find the location');
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const context = { ...mockContext, query: 'weather in London' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.formattedResponse).toContain('error while fetching weather');
    });

    it('should include weather metadata in response', async () => {
      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.coordinates).toBeDefined();
      expect(result.metadata!.coordinates.lat).toBe(40.7128);
      expect(result.metadata!.coordinates.lon).toBe(-74.0060);
    });

    it('should format weather response properly', async () => {
      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(true);
      expect(result.formattedResponse).toContain('🌤️');
      expect(result.formattedResponse).toContain('Temperature');
      expect(result.formattedResponse).toContain('Humidity');
      expect(result.formattedResponse).toContain('Wind');
    });
  });

  describe('healthCheck', () => {
    it('should return true when weather service is accessible', async () => {
      // Mock successful health check
      mockedAxios.get.mockResolvedValueOnce({
        data: { current: { temperature_2m: 20 } }
      });

      const isHealthy = await weatherPlugin.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when weather service is not accessible', async () => {
      // Mock failed health check
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const isHealthy = await weatherPlugin.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('plugin properties', () => {
    it('should have correct plugin information', () => {
      expect(weatherPlugin.name).toBe('weather');
      expect(weatherPlugin.version).toBe('1.0.0');
      expect(weatherPlugin.description).toContain('weather information');
    });
  });

  describe('location extraction', () => {
    it('should extract common location patterns', async () => {
      const locationQueries = [
        { query: 'weather in New York', expectedLocation: 'New York' },
        { query: 'what is the weather like in London?', expectedLocation: 'London' },
        { query: 'temperature for Tokyo', expectedLocation: 'Tokyo' },
        { query: 'how is the weather in San Francisco today?', expectedLocation: 'San Francisco' }
      ];

      // We'll test this indirectly by checking if the geocoding API is called
      for (const testCase of locationQueries) {
        const context = { ...mockContext, query: testCase.query };
        await weatherPlugin.execute(context);

        // Should have called geocoding API
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('geocoding-api.open-meteo.com')
        );
      }
    });
  });

  describe('error scenarios', () => {
    it('should handle invalid weather API response', async () => {
      // Mock geocoding success but weather API failure
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve(mockGeocodingResponse);
        } else {
          return Promise.reject(new Error('Weather API error'));
        }
      });

      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed API responses', async () => {
      // Mock invalid response structure
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({ data: { invalid: 'structure' } });
        }
        return Promise.resolve(mockWeatherResponse);
      });

      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      // Mock timeout
      mockedAxios.get.mockRejectedValueOnce({ code: 'ECONNABORTED' });

      const context = { ...mockContext, query: 'weather in London' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(false);
      expect(result.formattedResponse).toContain('error while fetching weather');
    });
  });

  describe('weather data formatting', () => {
    it('should format temperature units correctly', async () => {
      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(true);
      expect(result.formattedResponse).toMatch(/\d+\.?\d*°C/);
    });

    it('should format wind information', async () => {
      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(true);
      expect(result.formattedResponse).toMatch(/\d+\.?\d*\s*km\/h/);
    });

    it('should include humidity percentage', async () => {
      const context = { ...mockContext, query: 'weather in New York' };
      const result = await weatherPlugin.execute(context);

      expect(result.success).toBe(true);
      expect(result.formattedResponse).toMatch(/\d+%/);
    });
  });
});
