import { CorePluginRegistry } from './plugin-registry.service';
import { 
  Plugin, 
  PluginContext, 
  PluginResult, 
  PluginExecutionResult 
} from '../types/plugin.types';

export class PluginExecutionService {
  private registry: CorePluginRegistry;
  private defaultTimeout: number = 20000; // 20 seconds for network operations

  constructor() {
    this.registry = new CorePluginRegistry();
  }

  /**
   * Get the plugin registry
   */
  getRegistry(): CorePluginRegistry {
    return this.registry;
  }

  /**
   * Execute a specific plugin by name
   */
  async executePlugin(
    pluginName: string, 
    context: PluginContext
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    const plugin = this.registry.getPlugin(pluginName);

    if (!plugin) {
      return {
        pluginName,
        result: {
          success: false,
          error: `Plugin '${pluginName}' not found`
        },
        executionTime: Date.now() - startTime
      };
    }

    try {
      console.log(`🔧 Executing plugin: ${pluginName}`);
      const result = await this.executeWithTimeout(plugin, context, this.defaultTimeout);
      
      return {
        pluginName,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Plugin execution failed for ${pluginName}:`, error);
      return {
        pluginName,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute all applicable plugins for a context
   */
  async executeApplicablePlugins(context: PluginContext): Promise<PluginExecutionResult[]> {
    const applicablePlugins = this.registry.findApplicablePlugins(context);
    
    if (applicablePlugins.length === 0) {
      console.log('📭 No applicable plugins found for this context');
      return [];
    }

    const results: PluginExecutionResult[] = [];
    
    // Execute plugins in parallel for better performance
    const promises = applicablePlugins.map(plugin => 
      this.executePlugin(plugin.name, context)
    );

    try {
      const executionResults = await Promise.allSettled(promises);
      
      executionResults.forEach((promiseResult, index) => {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          const pluginName = applicablePlugins[index].name;
          results.push({
            pluginName,
            result: {
              success: false,
              error: `Plugin execution promise rejected: ${promiseResult.reason}`
            },
            executionTime: 0
          });
        }
      });
    } catch (error) {
      console.error('Error in parallel plugin execution:', error);
    }

    return results;
  }

  /**
   * Execute plugin with timeout
   */
  private async executeWithTimeout(
    plugin: Plugin, 
    context: PluginContext, 
    timeout: number
  ): Promise<PluginResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Plugin ${plugin.name} execution timed out after ${timeout}ms`));
      }, timeout);

      plugin.execute(context)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get execution service stats
   */
  getStats(): {
    registryStats: any;
    totalExecutions: number;
    lastExecutionTime?: string;
  } {
    return {
      registryStats: this.registry.getStats(),
      totalExecutions: 0, // We could track this with a counter
      lastExecutionTime: new Date().toISOString()
    };
  }

  /**
   * Health check for plugin system
   */
  async healthCheck(): Promise<{
    status: string;
    pluginHealth: Record<string, boolean>;
    registryHealth: boolean;
  }> {
    try {
      const pluginHealth = await this.registry.healthCheckAll();
      const registryStats = this.registry.getStats();
      
      const allHealthy = Object.values(pluginHealth).every(health => health);
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        pluginHealth,
        registryHealth: registryStats.registryHealth
      };
    } catch (error) {
      console.error('Plugin system health check failed:', error);
      return {
        status: 'unhealthy',
        pluginHealth: {},
        registryHealth: false
      };
    }
  }
}
