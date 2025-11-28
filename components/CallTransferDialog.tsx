/**
 * Call Transfer Dialog Component
 * 
 * UI for transferring calls between agents or escalating to human agents.
 */

import React, { useState } from 'react';
import { X, User, Users, ArrowRight, AlertCircle } from 'lucide-react';
import { TransferType } from '../utils/callTransfer';

interface CallTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (type: TransferType, targetId?: string, reason?: string) => void;
  availableAgents?: Array<{ id: string; name: string; type: 'agent' | 'department' }>;
}

const CallTransferDialog: React.FC<CallTransferDialogProps> = ({
  isOpen,
  onClose,
  onTransfer,
  availableAgents = []
}) => {
  const [transferType, setTransferType] = useState<TransferType>('agent-to-agent');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleTransfer = () => {
    if (transferType === 'agent-to-agent' && !selectedTarget) {
      alert('Please select an agent or department');
      return;
    }

    onTransfer(transferType, selectedTarget || undefined, reason);
    setSelectedTarget('');
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">Transfer Call</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Transfer Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Transfer Type
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="transferType"
                value="agent-to-agent"
                checked={transferType === 'agent-to-agent'}
                onChange={(e) => setTransferType(e.target.value as TransferType)}
                className="text-indigo-600"
              />
              <Users size={18} className="text-slate-600" />
              <span className="text-sm text-slate-700">To Another Agent</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="transferType"
                value="to-human"
                checked={transferType === 'to-human'}
                onChange={(e) => setTransferType(e.target.value as TransferType)}
                className="text-indigo-600"
              />
              <User size={18} className="text-slate-600" />
              <span className="text-sm text-slate-700">Escalate to Human Agent</span>
            </label>
          </div>
        </div>

        {/* Target Selection */}
        {transferType === 'agent-to-agent' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Agent or Department
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select --</option>
              {availableAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.type === 'agent' ? 'Agent' : 'Department'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Reason (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you transferring this call?"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
          />
        </div>

        {/* Warning for Human Escalation */}
        {transferType === 'to-human' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-amber-600 mt-0.5" />
            <div className="text-xs text-amber-800">
              This will escalate the call to a human agent. Make sure the customer is aware of the transfer.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowRight size={16} />
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallTransferDialog;

