import axios from 'axios';
import { Plugin, PluginContext, PluginResult } from '../types/plugin.types';

interface WeatherData {
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    weatherCode: number;
    time: string;
  };
  units: {
    temperature: string;
    windSpeed: string;
  };
}

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export class WeatherPlugin implements Plugin {
  name = 'weather';
  description = 'Provides current weather information for any location using Open-Meteo API';
  version = '1.0.0';

  private baseUrl = 'https://api.open-meteo.com/v1/forecast';
  private geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';

  /**
   * Check if this plugin can handle the given context
   */
  canHandle(context: PluginContext): boolean {
    const query = context.query.toLowerCase();
    const weatherKeywords = [
      'weather', 'temperature', 'climate', 'forecast', 'rain', 'snow',
      'wind', 'humidity', 'hot', 'cold', 'sunny', 'cloudy', 'storm'
    ];

    const weatherPatterns = [
      /weather\s+in\s+/i,
      /temperature\s+in\s+/i,
      /how\s+is\s+the\s+weather/i,
      /what\s+is\s+the\s+weather/i,
      /weather\s+today/i,
      /current\s+weather/i
    ];

    const hasKeyword = weatherKeywords.some(keyword => query.includes(keyword));
    const hasPattern = weatherPatterns.some(pattern => pattern.test(context.query));

    return hasKeyword || hasPattern;
  }

  /**
   * Execute the weather plugin
   */
  async execute(context: PluginContext): Promise<PluginResult> {
    try {
      console.log(`🌤️ Weather plugin executing for query: "${context.query}"`);

      // Extract location from query
      const location = this.extractLocation(context.query);
      
      if (!location) {
        return {
          success: false,
          error: 'Could not extract location from query',
          formattedResponse: 'I need a location to get weather information. Please specify a city or location.'
        };
      }

      // Get coordinates for the location
      const coordinates = await this.geocodeLocation(location);
      
      if (!coordinates) {
        return {
          success: false,
          error: `Location "${location}" not found`,
          formattedResponse: `I couldn't find the location "${location}". Please check the spelling or try a different location.`
        };
      }

      // Get weather data
      const weatherData = await this.getWeatherData(coordinates.latitude, coordinates.longitude);
      
      // Format the response
      const formattedResponse = this.formatWeatherResponse({
        location: `${coordinates.name}, ${coordinates.country}`,
        coordinates: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        },
        current: {
          temperature: weatherData.current.temperature_2m,
          humidity: weatherData.current.relative_humidity_2m,
          windSpeed: weatherData.current.wind_speed_10m,
          windDirection: weatherData.current.wind_direction_10m,
          weatherCode: weatherData.current.weather_code,
          time: weatherData.current.time
        },
        units: {
          temperature: weatherData.units.temperature_2m,
          windSpeed: weatherData.units.wind_speed_10m
        }
      });

      return {
        success: true,
        data: weatherData,
        formattedResponse,
        metadata: {
          location: coordinates.name,
          country: coordinates.country,
          coordinates: {
            lat: coordinates.latitude,
            lon: coordinates.longitude
          }
        }
      };

    } catch (error) {
      console.error('Weather plugin error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown weather service error',
        formattedResponse: 'Sorry, I encountered an error while fetching weather information. Please try again later.'
      };
    }
  }

  /**
   * Health check for weather plugin
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple request to London
      const response = await axios.get(this.baseUrl, {
        params: {
          latitude: 51.5074,
          longitude: -0.1278,
          current: 'temperature_2m',
          timeout: 5000
        },
        timeout: 5000
      });
      
      return response.status === 200 && response.data.current;
    } catch (error) {
      console.error('Weather plugin health check failed:', error);
      return false;
    }
  }

  /**
   * Extract location from user query
   */
  private extractLocation(query: string): string | null {
    // Patterns to extract location
    const patterns = [
      /weather\s+in\s+([^?!.]+)/i,
      /temperature\s+in\s+([^?!.]+)/i,
      /weather\s+for\s+([^?!.]+)/i,
      /weather\s+at\s+([^?!.]+)/i,
      /how\s+is\s+the\s+weather\s+in\s+([^?!.]+)/i,
      /what\s+is\s+the\s+weather\s+in\s+([^?!.]+)/i,
      /current\s+weather\s+in\s+([^?!.]+)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no pattern matches, look for common location indicators
    const words = query.toLowerCase().split(/\s+/);
    const locationIndex = words.findIndex(word => 
      ['in', 'for', 'at'].includes(word)
    );

    if (locationIndex !== -1 && locationIndex < words.length - 1) {
      return words.slice(locationIndex + 1).join(' ');
    }

    return null;
  }

  /**
   * Get coordinates for a location using Open-Meteo geocoding
   */
  private async geocodeLocation(location: string): Promise<GeocodingResult | null> {
    try {
      console.log(`🌍 Geocoding location: ${location}`);
      const response = await axios.get(this.geocodingUrl, {
        params: {
          name: location,
          count: 1,
          language: 'en',
          format: 'json'
        },
        timeout: 15000 // Increased timeout to 15 seconds
      });

      console.log(`📍 Geocoding response status: ${response.status}`);
      const results = response.data.results;
      if (results && results.length > 0) {
        console.log(`✅ Found coordinates for ${location}: ${results[0].latitude}, ${results[0].longitude}`);
        return results[0];
      }

      console.log(`❌ No results found for location: ${location}`);
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      if (error instanceof Error && 'code' in error && error.code === 'ECONNABORTED') {
        throw new Error('Location search timed out. Please try again.');
      }
      throw new Error('Failed to find location coordinates');
    }
  }

  /**
   * Get weather data from Open-Meteo
   */
  private async getWeatherData(latitude: number, longitude: number): Promise<{
    current: any;
    units: any;
  }> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          latitude,
          longitude,
          current: [
            'temperature_2m',
            'relative_humidity_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'weather_code'
          ].join(','),
          timezone: 'auto'
        },
        timeout: 15000 // Increased timeout
      });

      return {
        current: response.data.current,
        units: response.data.current_units
      };
    } catch (error) {
      console.error('Weather data fetch error:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  /**
   * Format weather response for user
   */
  private formatWeatherResponse(data: WeatherData): string {
    const { location, current, units } = data;
    
    // Convert weather code to description
    const weatherDescription = this.getWeatherDescription(current.weatherCode);
    
    const response = `🌤️ **Current Weather in ${location}**

🌡️ **Temperature**: ${current.temperature}${units.temperature}
💧 **Humidity**: ${current.humidity}%
💨 **Wind**: ${current.windSpeed} ${units.windSpeed} at ${current.windDirection}°
☁️ **Conditions**: ${weatherDescription}
🕐 **Last Updated**: ${new Date(current.time).toLocaleString()}

*Weather data provided by Open-Meteo*`;

    return response;
  }

  /**
   * Convert weather code to human-readable description
   */
  private getWeatherDescription(code: number): string {
    const weatherCodes: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };

    return weatherCodes[code] || `Weather code ${code}`;
  }
}
