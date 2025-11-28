/**
 * Unit tests for App Variant System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppVariantManager,
  AppVariantTemplate,
  TemplateLoader
} from '../../utils/appVariant';

describe('AppVariantManager', () => {
  let manager: AppVariantManager;

  beforeEach(() => {
    manager = new AppVariantManager();
  });

  describe('registerTemplate', () => {
    it('should register a template', () => {
      const template: AppVariantTemplate = {
        templateId: 'test_template',
        name: 'Test Template',
        description: 'A test template',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_1',
          systemPrompt: 'You are a test assistant',
          intents: ['intent1', 'intent2']
        },
        subAgents: [
          {
            module: 'TestModule',
            config: {
              agentId: 'sub_1',
              specialty: 'testing',
              systemPrompt: 'Test sub-agent',
              model: 'flash',
              tasks: ['test_task'],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template);
      const retrieved = manager.getTemplate('test_template');

      expect(retrieved).toBeDefined();
      expect(retrieved?.templateId).toBe('test_template');
    });
  });

  describe('loadVariant', () => {
    it('should load variant from registered template', () => {
      const template: AppVariantTemplate = {
        templateId: 'test_variant',
        name: 'Test Variant',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_test',
          systemPrompt: 'Test master',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'TestModule',
            config: {
              agentId: 'sub_test',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template);
      const config = manager.loadVariant('test_variant');

      expect(config).toBeDefined();
      expect(config.variantName).toBe('Test Variant');
      expect(config.masterAgentConfig.agentId).toBe('master_test');
      expect(config.subAgentConfigs.length).toBe(1);
    });

    it('should cache loaded variants', () => {
      const template: AppVariantTemplate = {
        templateId: 'cached_variant',
        name: 'Cached',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_cached',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub_cached',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template);
      const config1 = manager.loadVariant('cached_variant');
      const config2 = manager.loadVariant('cached_variant');

      expect(config1).toBe(config2);
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        manager.loadVariant('nonexistent');
      }).toThrow('Template not found: nonexistent');
    });

    it('should apply customizations to template', () => {
      const template: AppVariantTemplate = {
        templateId: 'custom_variant',
        name: 'Original',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_orig',
          systemPrompt: 'Original prompt',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub_orig',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template);
      const config = manager.loadVariant('custom_variant', {
        name: 'Customized Name',
        masterAgent: {
          systemPrompt: 'Custom prompt'
        }
      });

      expect(config.variantName).toBe('Customized Name');
      expect(config.masterAgentConfig.systemPrompt).toBe('Custom prompt');
    });

    it('should validate template structure', () => {
      const invalidTemplate: Partial<AppVariantTemplate> = {
        templateId: 'invalid',
        name: 'Invalid',
        description: 'Test',
        version: '1.0.0'
        // Missing masterAgent and subAgents
      };

      manager.registerTemplate(invalidTemplate as AppVariantTemplate);
      
      expect(() => {
        manager.loadVariant('invalid');
      }).toThrow();
    });
  });

  describe('validateTemplate', () => {
    it('should reject template without templateId', () => {
      const template = {
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: []
      };

      manager.registerTemplate(template as AppVariantTemplate);
      
      expect(() => {
        manager.loadVariant(template as any);
      }).toThrow();
    });

    it('should reject template without masterAgent', () => {
      const template: AppVariantTemplate = {
        templateId: 'no_master',
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master',
          systemPrompt: 'Test',
          intents: []
        },
        subAgents: []
      };

      // Test validation through loadVariant
      manager.registerTemplate(template);
      
      expect(() => {
        manager.loadVariant('no_master');
      }).toThrow();
    });

    it('should reject template without subAgents', () => {
      const template: AppVariantTemplate = {
        templateId: 'no_subs',
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: []
      };

      manager.registerTemplate(template);
      
      expect(() => {
        manager.loadVariant('no_subs');
      }).toThrow('Template must have at least one sub-agent');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return all registered templates', () => {
      const template1: AppVariantTemplate = {
        templateId: 'template1',
        name: 'Template 1',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master1',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub1',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      const template2: AppVariantTemplate = {
        templateId: 'template2',
        name: 'Template 2',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master2',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub2',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template1);
      manager.registerTemplate(template2);

      const templates = manager.getAvailableTemplates();
      expect(templates.length).toBe(2);
    });

    it('should return empty array if no templates registered', () => {
      const templates = manager.getAvailableTemplates();
      expect(templates).toEqual([]);
    });
  });

  describe('getTemplate', () => {
    it('should return template by ID', () => {
      const template: AppVariantTemplate = {
        templateId: 'get_template',
        name: 'Get Template',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template);
      const retrieved = manager.getTemplate('get_template');

      expect(retrieved).toBeDefined();
      expect(retrieved?.templateId).toBe('get_template');
    });

    it('should return null for non-existent template', () => {
      const retrieved = manager.getTemplate('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('loadTemplateFromJSON', () => {
    it('should load template from JSON string', () => {
      const templateJSON = JSON.stringify({
        templateId: 'json_template',
        name: 'JSON Template',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_json',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub_json',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      });

      const template = manager.loadTemplateFromJSON(templateJSON);
      expect(template.templateId).toBe('json_template');
      
      const retrieved = manager.getTemplate('json_template');
      expect(retrieved).toBeDefined();
    });

    it('should load template from JSON object', () => {
      const templateObj = {
        templateId: 'obj_template',
        name: 'Object Template',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_obj',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub_obj',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      const template = manager.loadTemplateFromJSON(templateObj);
      expect(template.templateId).toBe('obj_template');
    });
  });

  describe('convertMasterAgentConfig', () => {
    it('should convert template config to MasterAgentConfig', () => {
      const template: AppVariantTemplate = {
        templateId: 'convert_test',
        name: 'Convert Test',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_convert',
          systemPrompt: 'Test prompt',
          intents: ['intent1', 'intent2'],
          voiceSettings: {
            speed: 1.2,
            tone: 'friendly'
          },
          guardrails: {
            bannedPhrases: ['bad word']
          }
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub_convert',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      manager.registerTemplate(template);
      const config = manager.loadVariant('convert_test');

      expect(config.masterAgentConfig.agentId).toBe('master_convert');
      expect(config.masterAgentConfig.systemPrompt).toBe('Test prompt');
      expect(config.masterAgentConfig.intents).toEqual(['intent1', 'intent2']);
      expect(config.masterAgentConfig.voiceSettings).toBeDefined();
      expect(config.masterAgentConfig.guardrails).toBeDefined();
    });
  });
});

describe('TemplateLoader', () => {
  describe('loadTemplate', () => {
    it('should load template from object', async () => {
      const templateObj = {
        templateId: 'loader_obj',
        name: 'Loader Object',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master_loader',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub_loader',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      const template = await TemplateLoader.loadTemplate(templateObj);
      expect(template.templateId).toBe('loader_obj');
    });

    it('should throw error for file paths in browser', async () => {
      await expect(
        TemplateLoader.loadTemplate('/path/to/file.json')
      ).rejects.toThrow('File system loading not implemented in browser environment');
    });
  });

  describe('loadTemplates', () => {
    it('should load multiple templates', async () => {
      const template1 = {
        templateId: 'multi1',
        name: 'Multi 1',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master1',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub1',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      const template2 = {
        templateId: 'multi2',
        name: 'Multi 2',
        description: 'Test',
        version: '1.0.0',
        masterAgent: {
          agentId: 'master2',
          systemPrompt: 'Test',
          intents: ['intent1']
        },
        subAgents: [
          {
            module: 'Test',
            config: {
              agentId: 'sub2',
              specialty: 'test',
              systemPrompt: 'Test',
              model: 'flash',
              tasks: [],
              tools: []
            }
          }
        ]
      };

      const templates = await TemplateLoader.loadTemplates([template1, template2]);
      expect(templates.length).toBe(2);
      expect(templates[0].templateId).toBe('multi1');
      expect(templates[1].templateId).toBe('multi2');
    });
  });
});

