import React, { useId, useState } from 'react';

interface AccountFilterFieldProps {
  label: 'Folders' | 'Tags' | 'Companies';
  options: { id: string; name: string }[];
  selectedIds: string[];
  onChange(ids: string[]): void;
}

export function AccountFilterField({ label, options, selectedIds, onChange }: AccountFilterFieldProps) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const matches = options.filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="account-filter-field">
      <details>
        <summary>{label} <span>{selectedIds.length ? `${selectedIds.length} selected` : 'Any'}</span></summary>
        <div className="account-filter-menu">
          <label className="field-label" htmlFor={searchId}>Search {label.toLowerCase()}</label>
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="account-filter-options" role="group" aria-label={label}>
            {matches.map((option) => (
              <label className="checkbox-field" key={option.id}>
                <input type="checkbox" checked={selectedIds.includes(option.id)}
                  onChange={(event) => onChange(event.target.checked
                    ? [...selectedIds, option.id]
                    : selectedIds.filter((id) => id !== option.id))} />
                <span>{option.name}</span>
              </label>
            ))}
            {!matches.length && <p className="filter-help">{options.length ? 'No matching options.' : `No saved ${label.toLowerCase()}.`}</p>}
          </div>
        </div>
      </details>
      {selectedIds.length > 0 && (
        <div className="chip-row" aria-label={`Selected ${label.toLowerCase()}`}>
          {selectedIds.map((id) => (
            <span className={`chip ${label === 'Folders' ? 'folder-chip' : ''}`} key={id}>
              <span>{options.find((option) => option.id === id)?.name ?? 'Unavailable filter'}</span>
              <button type="button" aria-label={`Remove ${options.find((option) => option.id === id)?.name ?? 'unavailable filter'} from ${label} filters`}
                onClick={() => onChange(selectedIds.filter((selectedId) => selectedId !== id))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
