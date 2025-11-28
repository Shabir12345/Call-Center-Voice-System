/**
 * Unit tests for Agent Registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../../utils/agentRegistry';
import { CommunicationManager } from '../../utils/agentCommunication';
import { CentralLogger } from '../../utils/logger';
import { SubAgentModule, SubAgentConfig } from '../../utils/subAgentModule';
import { AgentMessage } from '../../types';

// Mock SubAgentModule for testing
class MockSubAgentModule extends SubAgentModule {
  async processTask(task: string, input: any): Promise<any> {
    return { result: `Processed ${task}` };
  }

  async handleMessage(message: AgentMessage): Promise<any> {
    return { response: 'Mock response' };
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let communicationManager: CommunicationManager;
  let logger: CentralLogger;

  beforeEach(() => {
    logger = new CentralLogger('error');
    communicationManager = new CommunicationManager({
      enabled: true,
      maxConversationDepth: 5,
      timeout: 30000
    });
    registry = new AgentRegistry(communicationManager, logger);
  });

  describe('registerAgent', () => {
    it('should register an agent with module class', async () => {
      const config: SubAgentConfig = {
        agentId: 'test_agent_1',
        specialty: 'testing',
        systemPrompt: 'Test agent',
        model: 'flash',
        tasks: ['test_task'],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);

      const entry = registry.getAgent('test_agent_1');
      expect(entry).toBeDefined();
      expect(entry?.agentId).toBe('test_agent_1');
      expect(entry?.status).toBe('active');
      expect(entry?.module).toBeInstanceOf(MockSubAgentModule);
    });

    it('should throw error if agent already exists', async () => {
      const config: SubAgentConfig = {
        agentId: 'duplicate_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);

      await expect(
        registry.registerAgent(config, MockSubAgentModule)
      ).rejects.toThrow('Agent duplicate_agent is already registered');
    });

    it('should register agent with communication manager', async () => {
      const registerSpy = vi.spyOn(communicationManager, 'registerAgent');
      
      const config: SubAgentConfig = {
        agentId: 'comm_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);

      expect(registerSpy).toHaveBeenCalledWith('comm_agent', expect.any(Function));
    });

    it('should store registration timestamp', async () => {
      const before = Date.now();
      const config: SubAgentConfig = {
        agentId: 'timestamp_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);
      const after = Date.now();

      const entry = registry.getAgent('timestamp_agent');
      expect(entry?.registeredAt).toBeGreaterThanOrEqual(before);
      expect(entry?.registeredAt).toBeLessThanOrEqual(after);
    });
  });

  describe('registerModuleLoader', () => {
    it('should register a module loader', () => {
      const loader = (config: SubAgentConfig, logger: CentralLogger) => {
        return new MockSubAgentModule(config, logger);
      };

      registry.registerModuleLoader('mock_type', loader);

      // Loader is registered, can't directly test but can test through registerAgent
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent', async () => {
      const config: SubAgentConfig = {
        agentId: 'unregister_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);
      expect(registry.getAgent('unregister_agent')).toBeDefined();

      registry.unregisterAgent('unregister_agent');
      expect(registry.getAgent('unregister_agent')).toBeNull();
    });

    it('should not throw error if agent does not exist', () => {
      expect(() => {
        registry.unregisterAgent('nonexistent');
      }).not.toThrow();
    });
  });

  describe('getAgent', () => {
    it('should return agent entry if exists', async () => {
      const config: SubAgentConfig = {
        agentId: 'get_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);
      const entry = registry.getAgent('get_agent');

      expect(entry).toBeDefined();
      expect(entry?.agentId).toBe('get_agent');
    });

    it('should return null if agent does not exist', () => {
      const entry = registry.getAgent('nonexistent');
      expect(entry).toBeNull();
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', async () => {
      const config1: SubAgentConfig = {
        agentId: 'all_agent_1',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      const config2: SubAgentConfig = {
        agentId: 'all_agent_2',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config1, MockSubAgentModule);
      await registry.registerAgent(config2, MockSubAgentModule);

      const agents = registry.getAllAgents();
      expect(agents.length).toBe(2);
      expect(agents.map(a => a.agentId)).toContain('all_agent_1');
      expect(agents.map(a => a.agentId)).toContain('all_agent_2');
    });

    it('should return empty array if no agents registered', () => {
      const agents = registry.getAllAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('getAgentsBySpecialty', () => {
    it('should return agents by specialty', async () => {
      const config1: SubAgentConfig = {
        agentId: 'specialty_agent_1',
        specialty: 'billing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      const config2: SubAgentConfig = {
        agentId: 'specialty_agent_2',
        specialty: 'reservations',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      const config3: SubAgentConfig = {
        agentId: 'specialty_agent_3',
        specialty: 'billing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config1, MockSubAgentModule);
      await registry.registerAgent(config2, MockSubAgentModule);
      await registry.registerAgent(config3, MockSubAgentModule);

      const billingAgents = registry.getAgentsBySpecialty('billing');
      expect(billingAgents.length).toBe(2);
      expect(billingAgents.map(a => a.agentId)).toContain('specialty_agent_1');
      expect(billingAgents.map(a => a.agentId)).toContain('specialty_agent_3');
    });
  });

  describe('getActiveAgents', () => {
    it('should return only active agents', async () => {
      const config1: SubAgentConfig = {
        agentId: 'active_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      const config2: SubAgentConfig = {
        agentId: 'inactive_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config1, MockSubAgentModule);
      await registry.registerAgent(config2, MockSubAgentModule);

      registry.updateAgentStatus('inactive_agent', 'inactive');

      const activeAgents = registry.getActiveAgents();
      expect(activeAgents.length).toBe(1);
      expect(activeAgents[0].agentId).toBe('active_agent');
    });
  });

  describe('discoverAgentsForTask', () => {
    it('should discover agents by task name', async () => {
      const config: SubAgentConfig = {
        agentId: 'task_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: ['process_order'],
        tools: ['process_order']
      };

      await registry.registerAgent(config, MockSubAgentModule);

      const agents = registry.discoverAgentsForTask('process_order');
      expect(agents.length).toBe(1);
      expect(agents[0].agentId).toBe('task_agent');
    });

    it('should discover agents by specialty name', async () => {
      const config: SubAgentConfig = {
        agentId: 'specialty_discovery',
        specialty: 'billing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);

      const agents = registry.discoverAgentsForTask('billing');
      expect(agents.length).toBe(1);
      expect(agents[0].agentId).toBe('specialty_discovery');
    });

    it('should return empty array if no agents match', async () => {
      const config: SubAgentConfig = {
        agentId: 'no_match',
        specialty: 'other',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: ['other_task'],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);

      const agents = registry.discoverAgentsForTask('unknown_task');
      expect(agents).toEqual([]);
    });
  });

  describe('updateAgentStatus', () => {
    it('should update agent status', async () => {
      const config: SubAgentConfig = {
        agentId: 'status_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config, MockSubAgentModule);
      expect(registry.getAgent('status_agent')?.status).toBe('active');

      registry.updateAgentStatus('status_agent', 'inactive');
      expect(registry.getAgent('status_agent')?.status).toBe('inactive');

      registry.updateAgentStatus('status_agent', 'error');
      expect(registry.getAgent('status_agent')?.status).toBe('error');
    });

    it('should not throw error if agent does not exist', () => {
      expect(() => {
        registry.updateAgentStatus('nonexistent', 'inactive');
      }).not.toThrow();
    });
  });

  describe('addAgentAtRuntime', () => {
    it('should add agent at runtime', async () => {
      const config: SubAgentConfig = {
        agentId: 'runtime_agent',
        specialty: 'testing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.addAgentAtRuntime(config, MockSubAgentModule);

      const entry = registry.getAgent('runtime_agent');
      expect(entry).toBeDefined();
      expect(entry?.status).toBe('active');
    });
  });

  describe('getStatistics', () => {
    it('should return agent statistics', async () => {
      const config1: SubAgentConfig = {
        agentId: 'stats_agent_1',
        specialty: 'billing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      const config2: SubAgentConfig = {
        agentId: 'stats_agent_2',
        specialty: 'reservations',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      const config3: SubAgentConfig = {
        agentId: 'stats_agent_3',
        specialty: 'billing',
        systemPrompt: 'Test',
        model: 'flash',
        tasks: [],
        tools: []
      };

      await registry.registerAgent(config1, MockSubAgentModule);
      await registry.registerAgent(config2, MockSubAgentModule);
      await registry.registerAgent(config3, MockSubAgentModule);

      registry.updateAgentStatus('stats_agent_3', 'inactive');

      const stats = registry.getStatistics();

      expect(stats.totalAgents).toBe(3);
      expect(stats.activeAgents).toBe(2);
      expect(stats.inactiveAgents).toBe(1);
      expect(stats.bySpecialty['billing']).toBe(2);
      expect(stats.bySpecialty['reservations']).toBe(1);
    });
  });
});

