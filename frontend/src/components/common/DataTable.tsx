import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import './DataTable.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface RowAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
  danger?: boolean;
  hidden?: (item: T) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  rowActions?: RowAction<T>[];
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  pageSize?: number;
  bulkActions?: { label: string; onClick: (selectedItems: T[]) => void; danger?: boolean }[];
  filtersNode?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  rowActions,
  onRowClick,
  searchPlaceholder = 'Search records...',
  searchFilter,
  emptyTitle = 'No records found',
  emptyDescription = 'There are currently no items to display.',
  emptyActionLabel,
  onEmptyAction,
  pageSize = 10,
  bulkActions,
  filtersNode,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null);

  // Portal-based dropdown positioning
  interface MenuPosition { top?: number; bottom?: number; right: number; }
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Close menu on scroll so it doesn't drift from its anchor
  useEffect(() => {
    if (!activeMenuKey) return;
    const close = () => setActiveMenuKey(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [activeMenuKey]);

  const openMenu = (key: string) => {
    const btn = triggerRefs.current[key];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 200) {
      // Flip above the button
      setMenuPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
    } else {
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setActiveMenuKey(key);
  };

  // Filter
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    if (searchFilter) {
      return data.filter(item => searchFilter(item, searchQuery.toLowerCase()));
    }
    return data.filter(item =>
      Object.values(item as any).some(val =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [data, searchQuery, searchFilter]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const res = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? res : -res;
    });
  }, [filteredData, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === paginatedData.length) {
      setSelectedKeys(new Set());
    } else {
      const newKeys = new Set(paginatedData.map(item => keyExtractor(item)));
      setSelectedKeys(newKeys);
    }
  };

  const toggleSelectRow = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedKeys(newSet);
  };

  const selectedItems = useMemo(() => {
    return data.filter(item => selectedKeys.has(keyExtractor(item)));
  }, [data, selectedKeys, keyExtractor]);

  return (
    <div className="data-table-container card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Top Bar: Search & Actions */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 360,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={16}
              style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 36, height: 38 }}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          {filtersNode}
        </div>

        {/* Bulk Action Bar */}
        {selectedKeys.size > 0 && bulkActions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--primary-50)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary-100)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-700)' }}>
              {selectedKeys.size} selected
            </span>
            {bulkActions.map((action, idx) => (
              <button
                key={idx}
                className={`btn btn-sm ${action.danger ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => {
                  action.onClick(selectedItems);
                  setSelectedKeys(new Set());
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table Body */}
      {paginatedData.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 13,
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-base)',
                  backgroundColor: 'var(--bg-surface-hover)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {bulkActions && (
                  <th style={{ width: 44, padding: '12px 16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        paginatedData.length > 0 &&
                        selectedKeys.size === paginatedData.length
                      }
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: 15, height: 15 }}
                    />
                  </th>
                )}
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={{
                      padding: '12px 16px',
                      width: col.width,
                      textAlign: col.align || 'left',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        justifyContent:
                          col.align === 'right'
                            ? 'flex-end'
                            : col.align === 'center'
                            ? 'center'
                            : 'flex-start',
                      }}
                    >
                      {col.header}
                      {col.sortable && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {sortKey === col.key ? (
                            sortOrder === 'asc' ? (
                              <ChevronUp size={14} color="var(--primary-600)" />
                            ) : (
                              <ChevronDown size={14} color="var(--primary-600)" />
                            )
                          ) : (
                            <ChevronDown size={14} style={{ opacity: 0.4 }} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {rowActions && rowActions.length > 0 && (
                  <th
                    style={{
                      width: 80,
                      minWidth: 80,
                      padding: '12px 16px',
                      textAlign: 'right',
                      position: 'sticky',
                      right: 0,
                      background: 'var(--bg-surface-hover)',
                      zIndex: 2,
                    }}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(item => {
                const rowKey = keyExtractor(item);
                const isSelected = selectedKeys.has(rowKey);

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(item)}
                    style={{
                      borderBottom: '1px solid var(--border-base)',
                      backgroundColor: isSelected
                        ? 'rgba(59, 130, 246, 0.04)'
                        : 'var(--bg-surface)',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }}
                  >
                    {bulkActions && (
                      <td
                        style={{ padding: '14px 16px', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => toggleSelectRow(rowKey, e as any)}
                          style={{ cursor: 'pointer', width: 15, height: 15 }}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td
                        key={col.key}
                        style={{
                          padding: '14px 16px',
                          textAlign: col.align || 'left',
                          verticalAlign: 'middle',
                          color: 'var(--text-primary)',
                          wordBreak: 'break-word',
                          whiteSpace: 'normal',
                        }}
                      >
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                    {rowActions && rowActions.length > 0 && (
                      <td
                        style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          position: 'sticky',
                          right: 0,
                          background: isSelected ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-surface)',
                          zIndex: 1,
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseEnter={e => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-hover)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                        }}
                      >
                        <button
                          ref={el => { triggerRefs.current[rowKey] = el; }}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ width: 30, height: 30 }}
                          onClick={() =>
                            activeMenuKey === rowKey ? setActiveMenuKey(null) : openMenu(rowKey)
                          }
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Portaled dropdown — renders into document.body, escapes all overflow clipping */}
      {activeMenuKey && menuPos && createPortal(
        <>
          {/* Click-outside backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setActiveMenuKey(null)}
          />
          <div
            className="card animate-slide-down"
            style={{
              position: 'fixed',
              top: menuPos.top,
              bottom: menuPos.bottom,
              right: menuPos.right,
              zIndex: 9999,
              minWidth: 168,
              padding: '6px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {(() => {
              const item = paginatedData.find(i => keyExtractor(i) === activeMenuKey);
              if (!item) return null;
              return rowActions!
                .filter(action => !action.hidden || !action.hidden(item))
                .map((action, aIdx) => (
                  <button
                    key={aIdx}
                    className="btn btn-ghost btn-sm"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      color: action.danger ? 'var(--danger)' : 'var(--text-primary)',
                    }}
                    onClick={() => {
                      setActiveMenuKey(null);
                      action.onClick(item);
                    }}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ));
            })()}
          </div>
        </>,
        document.body
      )}

      {/* Pagination Footer */}
      {sortedData.length > 0 && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
            {sortedData.length} records
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontWeight: 600, padding: '0 8px' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
