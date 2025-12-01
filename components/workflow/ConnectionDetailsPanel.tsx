/**
 * Connection Details Panel
 * 
 * Professional UI component for editing connection context cards.
 * Opens when a user clicks on a connection (edge) in the workflow editor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Eye, AlertTriangle, Shield, CheckCircle2, Info, Sparkles, Wand2, BookOpen, Settings, Zap, Target, Lock, Unlock, TrendingUp, HelpCircle, Lightbulb, ArrowRight } from 'lucide-react';
import { ConnectionContextCard, RiskLevel, ConnectionPrecondition } from '../../types';
import { getConnectionContextStorage } from '../../utils/connectionContextStorage';

// Connection templates for beginners
const CONNECTION_TEMPLATES = {
  collect_info: {
    name: 'Collect Information',
    purpose: 'Gather required information from the caller',
    whenToUse: 'Use this connection when you need to collect specific information from the caller, such as their name, account number, email, or other details required to proceed.',
    whenNotToUse: 'Do not use if the information has already been collected or if the caller is asking for something else.',
    riskLevel: 'low' as RiskLevel,
    requiresConfirmation: false,
    examplePhrases: ['provide my information', 'give you my details', 'tell you my account number'],
  },
  transfer: {
    name: 'Transfer to Department',
    purpose: 'Transfer the caller to a specialized department or agent',
    whenToUse: 'Use this connection when the caller needs to speak with a specific department (e.g., billing, technical support, sales) or when their request is outside your scope.',
    whenNotToUse: 'Do not use if you can handle the request directly or if the caller wants to stay with you.',
    riskLevel: 'low' as RiskLevel,
    requiresConfirmation: true,
    examplePhrases: ['transfer me', 'speak to someone', 'connect me to billing'],
  },
  explain_policy: {
    name: 'Explain Policy',
    purpose: 'Provide information about company policies, procedures, or terms',
    whenToUse: 'Use this connection when the caller is asking about policies, terms of service, refund policies, or how something works.',
    whenNotToUse: 'Do not use if the caller wants to take an action (use action connections instead).',
    riskLevel: 'low' as RiskLevel,
    requiresConfirmation: false,
    examplePhrases: ['what is your policy', 'how does this work', 'explain the terms'],
  },
  perform_action: {
    name: 'Perform Action',
    purpose: 'Execute an action on behalf of the caller',
    whenToUse: 'Use this connection when the caller wants to perform an action like updating their account, making a change, or processing a request.',
    whenNotToUse: 'Do not use for information requests or if the action requires special authorization.',
    riskLevel: 'medium' as RiskLevel,
    requiresConfirmation: true,
    examplePhrases: ['update my account', 'change my plan', 'process my request'],
  },
  sensitive_action: {
    name: 'Sensitive Action',
    purpose: 'Handle sensitive actions like cancellations, refunds, or account changes',
    whenToUse: 'Use this connection for high-stakes actions that significantly impact the caller, such as canceling a subscription, processing a refund, or making major account changes.',
    whenNotToUse: 'Do not use for routine actions or information requests.',
    riskLevel: 'high' as RiskLevel,
    requiresConfirmation: true,
    examplePhrases: ['cancel my subscription', 'request a refund', 'close my account'],
  },
};

interface ConnectionDetailsPanelProps {
  connectionId: string;
  fromNode: string;
  toNode: string;
  onClose: () => void;
  onSave?: (card: ConnectionContextCard) => void;
}

export const ConnectionDetailsPanel: React.FC<ConnectionDetailsPanelProps> = ({
  connectionId,
  fromNode,
  toNode,
  onClose,
  onSave,
}) => {
  const storage = getConnectionContextStorage();
  const [card, setCard] = useState<ConnectionContextCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'routing' | 'safety' | 'advanced'>('basic');

  // Load context card
  useEffect(() => {
    const loadCard = async () => {
      try {
        let contextCard = await storage.getContextCardByConnectionId(connectionId);
        
        if (!contextCard) {
          contextCard = storage.createDefaultContextCard(connectionId, fromNode, toNode);
          await storage.saveContextCard(contextCard);
        }
        
        setCard(contextCard);
      } catch (error) {
        console.error('Error loading context card:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCard();
  }, [connectionId, fromNode, toNode]);

  const handleSave = useCallback(async () => {
    if (!card) return;

    try {
      await storage.saveContextCard(card);
      onSave?.(card);
      onClose();
    } catch (error) {
      console.error('Error saving context card:', error);
      alert('Failed to save connection context. Please try again.');
    }
  }, [card, storage, onSave, onClose]);

  const updateCard = useCallback((updates: Partial<ConnectionContextCard>) => {
    setCard(prev => prev ? { ...prev, ...updates, updatedAt: Date.now() } : null);
  }, []);

  const addPrecondition = useCallback(() => {
    const newPrecondition: ConnectionPrecondition = {
      key: '',
      operator: 'equals',
      value: '',
    };
    updateCard({
      preconditions: [...(card?.preconditions || []), newPrecondition],
    });
  }, [card, updateCard]);

  const removePrecondition = useCallback((index: number) => {
    if (!card?.preconditions) return;
    const updated = [...card.preconditions];
    updated.splice(index, 1);
    updateCard({ preconditions: updated });
  }, [card, updateCard]);

  const updatePrecondition = useCallback((index: number, updates: Partial<ConnectionPrecondition>) => {
    if (!card?.preconditions) return;
    const updated = [...card.preconditions];
    updated[index] = { ...updated[index], ...updates };
    updateCard({ preconditions: updated });
  }, [card, updateCard]);

  const addExamplePhrase = useCallback(() => {
    updateCard({
      examplePhrases: [...(card?.examplePhrases || []), ''],
    });
  }, [card, updateCard]);

  const removeExamplePhrase = useCallback((index: number) => {
    if (!card?.examplePhrases) return;
    const updated = [...card.examplePhrases];
    updated.splice(index, 1);
    updateCard({ examplePhrases: updated });
  }, [card, updateCard]);

  const updateExamplePhrase = useCallback((index: number, value: string) => {
    if (!card?.examplePhrases) return;
    const updated = [...card.examplePhrases];
    updated[index] = value;
    updateCard({ examplePhrases: updated });
  }, [card, updateCard]);

  const applyTemplate = useCallback((templateKey: keyof typeof CONNECTION_TEMPLATES) => {
    const template = CONNECTION_TEMPLATES[templateKey];
    updateCard({
      name: template.name,
      purpose: template.purpose,
      whenToUse: template.whenToUse,
      whenNotToUse: template.whenNotToUse,
      riskLevel: template.riskLevel,
      requiresConfirmation: template.requiresConfirmation,
      examplePhrases: template.examplePhrases,
    });
    setShowTemplates(false);
  }, [updateCard]);

  if (loading || !card) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading connection details...</p>
        </div>
      </div>
    );
  }

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Premium Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <ArrowRight className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Connection Configuration</h2>
                <p className="text-indigo-100 text-sm mt-1 font-medium flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-1 rounded text-xs">{fromNode}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="bg-white/20 px-2 py-1 rounded text-xs">{toNode}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all backdrop-blur-sm"
                title="Templates"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`p-2.5 rounded-xl transition-all backdrop-blur-sm ${
                  previewMode ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'
                }`}
                title="Preview"
              >
                <Eye className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all backdrop-blur-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Templates Banner */}
        {showTemplates && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-4 animate-slideDown">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Quick Start Templates
              </h3>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(CONNECTION_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key as keyof typeof CONNECTION_TEMPLATES)}
                  className="text-left p-3 bg-white border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group"
                >
                  <div className="font-semibold text-sm text-blue-900 group-hover:text-blue-700 mb-1">
                    {template.name}
                  </div>
                  <div className="text-xs text-blue-600 line-clamp-2">{template.purpose}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview Banner */}
        {previewMode && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 p-4">
            <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              AI Preview - How the AI sees this connection
            </h3>
            <div className="bg-white rounded-lg p-4 border border-purple-200 space-y-2 text-sm">
              <div><span className="font-semibold text-purple-700">Purpose:</span> <span className="text-gray-700">{card.purpose}</span></div>
              <div><span className="font-semibold text-purple-700">When to use:</span> <span className="text-gray-700">{card.whenToUse}</span></div>
              {card.whenNotToUse && (
                <div><span className="font-semibold text-purple-700">When NOT to use:</span> <span className="text-gray-700">{card.whenNotToUse}</span></div>
              )}
              {card.examplePhrases && card.examplePhrases.length > 0 && (
                <div><span className="font-semibold text-purple-700">Examples:</span> <span className="text-gray-700">{card.examplePhrases.join(', ')}</span></div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-purple-700">Risk:</span>
                <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getRiskColor(card.riskLevel)}`}>
                  {card.riskLevel.toUpperCase()}
                </span>
              </div>
              {card.requiresConfirmation && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-semibold">Requires confirmation</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1 px-6 pt-4">
            {[
              { id: 'basic', label: 'Basic Info', icon: Settings },
              { id: 'routing', label: 'Routing Rules', icon: Target },
              { id: 'safety', label: 'Safety & Risk', icon: Shield },
              { id: 'advanced', label: 'Advanced', icon: Zap },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm rounded-t-xl transition-all ${
                  activeTab === id
                    ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-white/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Connection Name
                  </label>
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) => updateCard({ name: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                    placeholder="e.g., Collect Customer Information"
                  />
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Connection Status
                    </label>
                    <button
                      onClick={() => updateCard({ enabled: !card.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        card.enabled ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          card.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {card.enabled ? 'Connection is active and available for routing' : 'Connection is disabled and will be skipped'}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Priority
                    <HelpCircle className="w-4 h-4 text-gray-400" title="Higher priority connections are preferred when scores are equal" />
                  </label>
                  <input
                    type="number"
                    value={card.priority}
                    onChange={(e) => updateCard({ priority: parseInt(e.target.value) || 0 })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">Default: 0. Higher values = higher priority</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={card.purpose}
                    onChange={(e) => updateCard({ purpose: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                    placeholder="Short description of what this connection is for"
                  />
                </div>
              </div>
            )}

            {/* Routing Rules Tab */}
            {activeTab === 'routing' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    When to Use
                    <span className="text-red-500">*</span>
                    <HelpCircle className="w-4 h-4 text-gray-400" title="This is critical for intent matching. Be specific and clear." />
                  </label>
                  <textarea
                    value={card.whenToUse}
                    onChange={(e) => updateCard({ whenToUse: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 h-32 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                    placeholder="Describe when the caller is trying to... (e.g., 'Use this connection when the caller wants to upgrade their plan')"
                  />
                  <p className="text-xs text-gray-500 mt-2">This description is used by the AI to match caller intent</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    When NOT to Use
                  </label>
                  <textarea
                    value={card.whenNotToUse || ''}
                    onChange={(e) => updateCard({ whenNotToUse: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 h-24 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                    placeholder="Describe contraindications and forbidden topics (optional)"
                  />
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Example Phrases
                  </label>
                  <div className="space-y-3">
                    {card.examplePhrases?.map((phrase, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={phrase}
                          onChange={(e) => updateExamplePhrase(index, e.target.value)}
                          className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                          placeholder="e.g., 'upgrade my plan', 'cancel subscription'"
                        />
                        <button
                          onClick={() => removeExamplePhrase(index)}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addExamplePhrase}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors font-medium text-sm"
                    >
                      + Add Example Phrase
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Safety Tab */}
            {activeTab === 'safety' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    Risk Level
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['low', 'medium', 'high'] as RiskLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => updateCard({ riskLevel: level })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          card.riskLevel === level
                            ? `${getRiskColor(level)} border-current`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-semibold capitalize mb-1">{level}</div>
                        <div className="text-xs text-gray-600">
                          {level === 'low' && 'Safe operations'}
                          {level === 'medium' && 'Moderate impact'}
                          {level === 'high' && 'High stakes'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {card.riskLevel !== 'low' && (
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Risk Notes
                    </label>
                    <textarea
                      value={card.riskNotes || ''}
                      onChange={(e) => updateCard({ riskNotes: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 h-24 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                      placeholder="Explain why this connection is risky (e.g., 'changes billing', 'cancels service')"
                    />
                  </div>
                )}

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      Requires Confirmation
                      <HelpCircle className="w-4 h-4 text-gray-400" title="AI will ask caller for confirmation before using this connection" />
                    </label>
                    <button
                      onClick={() => updateCard({ requiresConfirmation: !card.requiresConfirmation })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        card.requiresConfirmation ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          card.requiresConfirmation ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    Preconditions
                  </label>
                  <p className="text-xs text-gray-500 mb-4">Required data/flags before this connection can be used</p>
                  <div className="space-y-3">
                    {card.preconditions?.map((precondition, index) => (
                      <div key={index} className="flex gap-2 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="text"
                          value={precondition.key}
                          onChange={(e) => updatePrecondition(index, { key: e.target.value })}
                          className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                          placeholder="e.g., customer_id_collected"
                        />
                        <select
                          value={precondition.operator}
                          onChange={(e) => updatePrecondition(index, { operator: e.target.value as any })}
                          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="exists">exists</option>
                          <option value="not_exists">not exists</option>
                          <option value="greater_than">greater than</option>
                          <option value="less_than">less than</option>
                        </select>
                        {!['exists', 'not_exists'].includes(precondition.operator) && (
                          <input
                            type="text"
                            value={precondition.value || ''}
                            onChange={(e) => updatePrecondition(index, { value: e.target.value })}
                            className="w-32 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                            placeholder="value"
                          />
                        )}
                        <button
                          onClick={() => removePrecondition(index)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addPrecondition}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors font-medium text-sm"
                    >
                      + Add Precondition
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    System Prompt Additions
                  </label>
                  <textarea
                    value={card.systemPromptAdditions || ''}
                    onChange={(e) => updateCard({ systemPromptAdditions: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 h-32 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none font-mono text-sm"
                    placeholder="Extra instructions injected only when this connection is being considered/used"
                  />
                  <p className="text-xs text-gray-500 mt-2">These instructions are merged into the system prompt at runtime</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Usage Examples
                  </label>
                  <textarea
                    value={card.usageExamples?.join('\n\n') || ''}
                    onChange={(e) => updateCard({ usageExamples: e.target.value.split('\n\n').filter(s => s.trim()) })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 h-32 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                    placeholder="2-5 short example dialogues or instructions (separate with blank lines)"
                  />
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={card.tags?.join(', ') || ''}
                    onChange={(e) => updateCard({ tags: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                    placeholder="billing, technical-support, urgent (comma-separated)"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-white p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            Save Connection
          </button>
        </div>
      </div>
    </div>
  );
};
