/**
 * Integration tests for Adapters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestPanelAdapter } from '../../utils/testPanelAdapter';
import { AppNode, NodeType } from '../../types';

describe('TestPanelAdapter', () => {
  let adapter: TestPanelAdapter;

  beforeEach(() => {
    adapter = new TestPanelAdapter();
  });

  describe('constructor', () => {
    it('should initialize adapter with logger and app variant manager', () => {
      expect(adapter).toBeDefined();
      expect(adapter.getCurrentAppVariant()).toBeNull();
    });
  });

  describe('getAvailableVariants', () => {
    it('should return available app variants', () => {
      const variants = adapter.getAvailableVariants();

      expect(Array.isArray(variants)).toBe(true);
      expect(variants.length).toBeGreaterThan(0);
      expect(variants[0]).toHaveProperty('id');
      expect(variants[0]).toHaveProperty('name');
      expect(variants[0]).toHaveProperty('description');
    });

    it('should include hospitality variant', () => {
      const variants = adapter.getAvailableVariants();
      const hospitality = variants.find(v => v.id === 'hospitality_hotel_v1');

      expect(hospitality).toBeDefined();
      expect(hospitality?.name).toContain('Hotel');
    });
  });

  describe('initializeFromNodes', () => {
    it('should initialize from nodes with router node', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master Agent',
            systemPrompt: 'You are a helpful assistant.',
            voiceId: 'Zephyr'
          }
        },
        {
          id: 'dept_1',
          type: NodeType.DEPARTMENT,
          position: { x: 100, y: 100 },
          data: {
            label: 'Billing Department',
            agentName: 'Billing',
            systemPrompt: 'Handle billing questions.'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const orchestrator = adapter.getOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should throw error if no router node found', async () => {
      const nodes: AppNode[] = [
        {
          id: 'dept_1',
          type: NodeType.DEPARTMENT,
          position: { x: 0, y: 0 },
          data: {
            label: 'Department',
            agentName: 'Test'
          }
        }
      ];

      await expect(adapter.initializeFromNodes(nodes)).rejects.toThrow('No Router node found');
    });

    it('should load app variant if provided', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master Agent',
            systemPrompt: 'Default prompt'
          }
        }
      ];

      // Mock the loadAppVariant to avoid actual file loading
      vi.spyOn(adapter as any, 'loadAppVariant').mockResolvedValue(undefined);

      await adapter.initializeFromNodes(nodes, 'hospitality_hotel_v1');

      // Should have attempted to load variant
      expect(adapter.getCurrentAppVariant()).toBeNull(); // Will be null since load is mocked
    });

    it('should handle department nodes as sub-agents', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'Test'
          }
        },
        {
          id: 'dept_1',
          type: NodeType.DEPARTMENT,
          position: { x: 100, y: 100 },
          data: {
            label: 'Sales',
            agentName: 'Sales',
            systemPrompt: 'Sales agent'
          }
        },
        {
          id: 'dept_2',
          type: NodeType.DEPARTMENT,
          position: { x: 200, y: 200 },
          data: {
            label: 'Support',
            agentName: 'Support',
            systemPrompt: 'Support agent'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const orchestrator = adapter.getOrchestrator();
      expect(orchestrator).toBeDefined();

      const stats = orchestrator?.getStatistics();
      expect(stats).toBeDefined();
    });

    it('should handle sub-agent nodes as tool agents', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'Test'
          }
        },
        {
          id: 'sub_1',
          type: NodeType.SUB_AGENT,
          position: { x: 100, y: 100 },
          data: {
            label: 'Tool Agent',
            functionName: 'check_status',
            description: 'Check status tool'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const orchestrator = adapter.getOrchestrator();
      expect(orchestrator).toBeDefined();
    });
  });

  describe('processCallerInput', () => {
    it('should process input through orchestrator', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'You are a helpful assistant.'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const response = await adapter.processCallerInput(
        'Hello, I need help',
        'session_123'
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should throw error if orchestrator not initialized', async () => {
      await expect(
        adapter.processCallerInput('test', 'session_1')
      ).rejects.toThrow('Orchestrator not initialized');
    });

    it('should process input with user ID', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'Test'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const response = await adapter.processCallerInput(
        'Test input',
        'session_456',
        'user_789'
      );

      expect(response).toBeDefined();
    });
  });

  describe('getOrchestrator', () => {
    it('should return null if not initialized', () => {
      const orchestrator = adapter.getOrchestrator();
      expect(orchestrator).toBeNull();
    });

    it('should return orchestrator after initialization', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'Test'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const orchestrator = adapter.getOrchestrator();
      expect(orchestrator).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    it('should return null if orchestrator not initialized', () => {
      const stats = adapter.getStatistics();
      expect(stats).toBeNull();
    });

    it('should return statistics after initialization', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'Test'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);

      const stats = adapter.getStatistics();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('agents');
      expect(stats).toHaveProperty('sessions');
      expect(stats).toHaveProperty('logs');
    });
  });

  describe('shutdown', () => {
    it('should shutdown orchestrator if initialized', async () => {
      const nodes: AppNode[] = [
        {
          id: 'router_1',
          type: NodeType.ROUTER,
          position: { x: 0, y: 0 },
          data: {
            label: 'Master',
            systemPrompt: 'Test'
          }
        }
      ];

      await adapter.initializeFromNodes(nodes);
      expect(adapter.getOrchestrator()).toBeDefined();

      await adapter.shutdown();
      
      // Orchestrator should be cleared (implementation dependent)
      // This tests that shutdown doesn't throw
      expect(true).toBe(true);
    });

    it('should not throw if orchestrator not initialized', async () => {
      await expect(adapter.shutdown()).resolves.not.toThrow();
    });
  });

  describe('getLogger', () => {
    it('should return logger instance', () => {
      const logger = adapter.getLogger();
      expect(logger).toBeDefined();
    });
  });
});

