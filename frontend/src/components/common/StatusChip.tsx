import React from 'react';
import { getStatusStyle } from '../../constants/statusColors';
import './StatusChip.css';

interface StatusChipProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const style = getStatusStyle(status);

  return (
    <span
      className={`status-chip ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
        fontSize: size === 'sm' ? '11px' : '12px',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
      }}
    >
      <span className="status-dot" style={{ backgroundColor: style.text }} />
      {label || status}
    </span>
  );
};
