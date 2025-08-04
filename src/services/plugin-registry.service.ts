import { Plugin, PluginRegistry, PluginContext } from '../types/plugin.types';

export class CorePluginRegistry implements PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  /**
   * Register a new plugin
   */
  register(plugin: Plugin): void {
    console.log(`🔌 Registering plugin: ${plugin.name} v${plugin.version}`);
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): boolean {
    const existed = this.plugins.has(pluginName);
    if (existed) {
      this.plugins.delete(pluginName);
      console.log(`🗑️ Unregistered plugin: ${pluginName}`);
    }
    return existed;
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Find plugins that can handle the given context
   */
  findApplicablePlugins(context: PluginContext): Plugin[] {
    const applicablePlugins: Plugin[] = [];
    
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.canHandle(context)) {
          applicablePlugins.push(plugin);
        }
      } catch (error) {
        console.error(`Error checking if plugin ${plugin.name} can handle context:`, error);
      }
    }

    console.log(`🔍 Found ${applicablePlugins.length} applicable plugins for query: "${context.query}"`);
    return applicablePlugins;
  }

  /**
   * Get registry stats
   */
  getStats(): {
    totalPlugins: number;
    pluginNames: string[];
    registryHealth: boolean;
  } {
    return {
      totalPlugins: this.plugins.size,
      pluginNames: Array.from(this.plugins.keys()),
      registryHealth: true
    };
  }

  /**
   * Health check for all plugins
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.healthCheck) {
          results[name] = await plugin.healthCheck();
        } else {
          results[name] = true; // No health check means healthy
        }
      } catch (error) {
        console.error(`Health check failed for plugin ${name}:`, error);
        results[name] = false;
      }
    }
    
    return results;
  }
}
