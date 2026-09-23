import React from 'react';
import { Filter, X } from 'lucide-react';
import './FilterBar.css';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  /** Stable identifier used as the React key */
  key: string;
  /** Human-readable label shown beside the select */
  label: string;
  /** Available choices — "All" (or custom placeholder) is added automatically as the first option */
  options: FilterOption[];
  /** Optional custom text for the default unselected option (defaults to "All") */
  placeholder?: string;
  allLabel?: string;
  /** Controlled value (use 'All' for the default / unset state) */
  value: string;
  onChange: (value: string) => void;
}

export interface DateRangeDef {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export interface FilterBarProps {
  /** One entry per select dropdown that should be rendered */
  filters: FilterDef[];
  /** Optional date-range picker (two date inputs rendered side-by-side) */
  dateRange?: DateRangeDef;
  /**
   * Called when the user clicks "Clear filters".
   * The button is only shown when at least one filter differs from 'All'
   * or when a date range value is non-empty.
   */
  onClearAll?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  dateRange,
  onClearAll,
}) => {
  const hasActiveFilter =
    filters.some(f => f.value !== 'All' && f.value !== '') ||
    (dateRange ? dateRange.from !== '' || dateRange.to !== '' : false);

  return (
    <div className="filterbar-container">
      {/* Label */}
      <span className="filterbar-label">
        <Filter size={13} />
        Filters:
      </span>

      {/* Select Dropdowns */}
      {filters.map(filter => (
        <div key={filter.key} className="filterbar-item">
          <label
            htmlFor={`filter-${filter.key}`}
            className="filterbar-item-label"
          >
            {filter.label}:
          </label>
          <select
            id={`filter-${filter.key}`}
            className={`form-select filterbar-select ${filter.value !== 'All' && filter.value !== '' ? 'active' : ''}`}
            value={filter.value}
            onChange={e => filter.onChange(e.target.value)}
          >
            <option value="All">{filter.placeholder || filter.allLabel || 'All'}</option>
            {filter.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Optional Date Range Picker */}
      {dateRange && (
        <div className="filterbar-date-group">
          <label className="filterbar-item-label">
            From:
          </label>
          <input
            type="date"
            className={`form-input filterbar-date-input ${dateRange.from !== '' ? 'active' : ''}`}
            value={dateRange.from}
            onChange={e => dateRange.onChange(e.target.value, dateRange.to)}
          />
          <label className="filterbar-item-label">
            To:
          </label>
          <input
            type="date"
            className={`form-input filterbar-date-input ${dateRange.to !== '' ? 'active' : ''}`}
            value={dateRange.to}
            onChange={e => dateRange.onChange(dateRange.from, e.target.value)}
          />
        </div>
      )}

      {/* Clear All — only visible when something is active */}
      {hasActiveFilter && onClearAll && (
        <button
          className="btn btn-ghost btn-sm filterbar-clear-btn"
          onClick={onClearAll}
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
};
