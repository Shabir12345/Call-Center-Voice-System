/**
 * Call Quality Report Component
 * 
 * Displays call quality scores and breakdown.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Award, AlertCircle } from 'lucide-react';
import { QualityScore } from '../utils/callQualityScorer';

interface CallQualityReportProps {
  score: QualityScore;
  sessionId: string;
  onClose?: () => void;
}

const CallQualityReport: React.FC<CallQualityReportProps> = ({ score, sessionId, onClose }) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'excellent': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'good': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'fair': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'poor': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getCategory = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (value >= 90) return 'excellent';
    if (value >= 75) return 'good';
    if (value >= 60) return 'fair';
    return 'poor';
  };

  const category = getCategory(score.overall);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-6 w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Call Quality Report</h3>
          <p className="text-sm text-slate-500">Session: {sessionId.substring(0, 20)}...</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            Close
          </button>
        )}
      </div>

      {/* Overall Score */}
      <div className={`mb-6 p-6 rounded-lg border-2 ${getCategoryColor(category)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold mb-1">Overall Quality Score</div>
            <div className="text-4xl font-bold">{score.overall}/100</div>
            <div className="text-sm mt-1 capitalize">{category}</div>
          </div>
          <Award size={48} className="opacity-50" />
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Quality Factors</h4>
        <div className="space-y-4">
          {Object.entries(score.factors).map(([key, value]) => {
            const factorCategory = getCategory(value);
            const weight = score.breakdown[`${key}Weight` as keyof typeof score.breakdown] * 100;
            
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      factorCategory === 'excellent' ? 'text-emerald-600' :
                      factorCategory === 'good' ? 'text-indigo-600' :
                      factorCategory === 'fair' ? 'text-amber-600' :
                      'text-rose-600'
                    }`}>
                      {value}/100
                    </span>
                    <span className="text-xs text-slate-500">({weight.toFixed(0)}% weight)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      factorCategory === 'excellent' ? 'bg-emerald-500' :
                      factorCategory === 'good' ? 'bg-indigo-500' :
                      factorCategory === 'fair' ? 'bg-amber-500' :
                      'bg-rose-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Score Calculation</h4>
        <div className="space-y-2 text-xs text-slate-600">
          {Object.entries(score.factors).map(([key, value]) => {
            const weight = score.breakdown[`${key}Weight` as keyof typeof score.breakdown];
            const contribution = value * weight;
            
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span className="font-mono">
                  {value} × {(weight * 100).toFixed(0)}% = {contribution.toFixed(1)}
                </span>
              </div>
            );
          })}
          <div className="pt-2 border-t border-slate-300 flex items-center justify-between font-semibold text-slate-800">
            <span>Total:</span>
            <span className="font-mono">{score.overall}/100</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallQualityReport;

