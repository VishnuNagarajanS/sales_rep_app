import React from 'react';
import { Inbox } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`card text-center empty-state-card ${className}`}>
      <div className="empty-state-icon-circle">
        {icon || <Inbox size={28} />}
      </div>
      <h3 className="empty-state-title">
        {title}
      </h3>
      {description && (
        <p className={`empty-state-description ${actionLabel ? 'with-action' : ''}`}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
