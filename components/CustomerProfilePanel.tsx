/**
 * Customer Profile Panel Component
 * 
 * Displays customer profile information during calls.
 */

import React from 'react';
import { User, Mail, Phone, Building, Tag, Clock, X } from 'lucide-react';
import { CustomerProfile } from '../types';

interface CustomerProfilePanelProps {
  profile: CustomerProfile | null;
  onClose?: () => void;
}

const CustomerProfilePanel: React.FC<CustomerProfilePanelProps> = ({ profile, onClose }) => {
  if (!profile) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-full max-w-sm">
        <div className="text-center text-slate-400 py-8">
          <User size={48} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No customer profile found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <User size={18} className="text-indigo-600" />
          Customer Profile
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X size={16} className="text-slate-600" />
          </button>
        )}
      </div>

      {/* Profile Info */}
      <div className="space-y-3">
        {profile.name && (
          <div className="flex items-start gap-3">
            <User size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-500">Name</div>
              <div className="text-sm font-semibold text-slate-800">{profile.name}</div>
            </div>
          </div>
        )}

        {profile.email && (
          <div className="flex items-start gap-3">
            <Mail size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-500">Email</div>
              <div className="text-sm text-slate-700">{profile.email}</div>
            </div>
          </div>
        )}

        {profile.phoneNumber && (
          <div className="flex items-start gap-3">
            <Phone size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-500">Phone</div>
              <div className="text-sm text-slate-700">{profile.phoneNumber}</div>
            </div>
          </div>
        )}

        {profile.company && (
          <div className="flex items-start gap-3">
            <Building size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-500">Company</div>
              <div className="text-sm text-slate-700">{profile.company}</div>
            </div>
          </div>
        )}

        {profile.tags && profile.tags.length > 0 && (
          <div className="flex items-start gap-3">
            <Tag size={16} className="text-slate-400 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-slate-500 mb-1">Tags</div>
              <div className="flex flex-wrap gap-1">
                {profile.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {profile.lastContact && (
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-500">Last Contact</div>
              <div className="text-sm text-slate-700">
                {new Date(profile.lastContact).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {profile.contactHistory && profile.contactHistory.length > 0 && (
          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500 mb-2">Recent History</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {profile.contactHistory.slice(0, 3).map((entry, index) => (
                <div key={index} className="text-xs text-slate-600">
                  <span className="font-semibold capitalize">{entry.type}:</span>{' '}
                  {entry.summary.substring(0, 50)}
                  {entry.summary.length > 50 ? '...' : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerProfilePanel;

