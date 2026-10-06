import React, { useState } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import './ExportReportModal.css';

interface ExportReportModalProps {
  onClose: () => void;
  onExport: (moduleName: string) => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({ onClose, onExport }) => {
  const [exportType, setExportType] = useState<'All' | 'Specific'>('All');
  const [selectedModule, setSelectedModule] = useState<string>('Leads');

  const modules = ['Leads', 'Deals', 'LeaveRequests', 'Consultations'];

  const handleExport = () => {
    onExport(exportType === 'All' ? 'All' : selectedModule);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container export-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Data</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Download your organization's data as a beautifully formatted Excel (.xlsx) file.
          </p>

          <div className="export-options">
            <label className={`export-option-card ${exportType === 'All' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'All'}
                onChange={() => setExportType('All')}
              />
              <div className="export-option-content">
                <FileSpreadsheet size={24} className="option-icon" />
                <div className="option-text">
                  <h4>Complete Report (All Modules)</h4>
                  <p>A single Excel file with multiple tabs for each module.</p>
                </div>
              </div>
            </label>

            <label className={`export-option-card ${exportType === 'Specific' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'Specific'}
                onChange={() => setExportType('Specific')}
              />
              <div className="export-option-content">
                <FileSpreadsheet size={24} className="option-icon" />
                <div className="option-text">
                  <h4>Specific Module</h4>
                  <p>Download a targeted report for a single module.</p>
                </div>
              </div>
            </label>
          </div>

          {exportType === 'Specific' && (
            <div className="specific-module-select">
              <label>Select Module</label>
              <select 
                value={selectedModule} 
                onChange={e => setSelectedModule(e.target.value)}
                className="form-control"
              >
                {modules.map(m => (
                  <option key={m} value={m}>{m === 'LeaveRequests' ? 'Leave Requests' : m}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} /> Download
          </button>
        </div>
      </div>
    </div>
  );
};
