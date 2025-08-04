/**
 * Plugin system types and interfaces
 */

export interface PluginContext {
  query: string;
  sessionId: string;
  userMessage: string;
  timestamp: string;
}

export interface PluginResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  formattedResponse?: string;
  metadata?: Record<string, any>;
}

export interface PluginExecutionResult {
  pluginName: string;
  result: PluginResult;
  executionTime: number;
}

export interface Plugin {
  name: string;
  description: string;
  version: string;
  canHandle(context: PluginContext): boolean;
  execute(context: PluginContext): Promise<PluginResult>;
  healthCheck?(): Promise<boolean>;
}

export interface PluginRegistry {
  register(plugin: Plugin): void;
  unregister(pluginName: string): boolean;
  getPlugin(pluginName: string): Plugin | undefined;
  getAllPlugins(): Plugin[];
  findApplicablePlugins(context: PluginContext): Plugin[];
}

export interface PluginConfig {
  enabled: boolean;
  priority: number;
  maxExecutionTime: number;
  retries: number;
  fallbackEnabled: boolean;
}
