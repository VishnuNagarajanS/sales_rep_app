import React from 'react';
import { PhoneCall, Calendar, MessageSquare, CheckCircle2, Tag } from 'lucide-react';
import './Timeline.css';

export interface TimelineEvent {
  id: string;
  type: 'call' | 'status_change' | 'note' | 'followup' | 'visit' | 'booking';
  title: string;
  description?: string;
  timestamp: string;
  actorName?: string;
  badge?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const getIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'call':
        return <PhoneCall size={14} color="#2563eb" />;
      case 'followup':
        return <Calendar size={14} color="#d97706" />;
      case 'visit':
        return <Calendar size={14} color="#7c3aed" />;
      case 'booking':
        return <CheckCircle2 size={14} color="#059669" />;
      case 'status_change':
        return <Tag size={14} color="#ec4899" />;
      case 'note':
      default:
        return <MessageSquare size={14} color="#64748b" />;
    }
  };

  if (events.length === 0) {
    return (
      <div className="timeline-empty">
        No activity history recorded yet.
      </div>
    );
  }

  return (
    <div className="timeline-container">
      {/* Vertical Connecting Line */}
      <div className="timeline-vertical-line" />

      <div className="timeline-event-list">
        {events.map(ev => (
          <div key={ev.id} className="timeline-event-item">
            {/* Dot / Icon */}
            <div className="timeline-icon-dot">
              {getIcon(ev.type)}
            </div>

            {/* Event Content */}
            <div className="timeline-event-card">
              <div className="timeline-event-header">
                <span className="timeline-event-title">
                  {ev.title}
                </span>
                <span className="timeline-event-time">{ev.timestamp}</span>
              </div>
              {ev.description && (
                <p className="timeline-event-desc">
                  {ev.description}
                </p>
              )}
              {ev.actorName && (
                <div className="timeline-event-actor">
                  by <span className="timeline-event-actor-name">{ev.actorName}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
