import { useMemo, useState } from 'react';

export interface MultiValueFieldProps {
  label: 'Tags' | 'Folders';
  values: string[];
  suggestions: string[];
  onChange(values: string[]): void;
  disabled?: boolean;
}

export function MultiValueField({ label, values, suggestions, onChange, disabled }: MultiValueFieldProps) {
  const [query, setQuery] = useState('');
  const normalized = useMemo(() => new Set(values.map((value) => value.toLowerCase())), [values]);
  const matches = suggestions.filter((value) =>
    !normalized.has(value.toLowerCase()) && value.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || normalized.has(trimmed.toLowerCase())) return;
    onChange([...values, trimmed]);
    setQuery('');
  }

  return (
    <div className="multi-value-field">
      <label htmlFor={`contexto-${label.toLowerCase()}`}>{label}</label>
      <div className="chip-row">
        {values.map((value) => (
          <span className={`chip ${label === 'Folders' ? 'folder-chip' : ''}`} key={value.toLowerCase()}>
            {value}
            <button type="button" disabled={disabled} aria-label={`Remove ${value} from ${label}`}
              onClick={() => onChange(values.filter((item) => item !== value))}>×</button>
          </span>
        ))}
      </div>
      <input id={`contexto-${label.toLowerCase()}`} value={query} disabled={disabled}
        autoComplete="off" aria-autocomplete="list"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(query);
          }
        }} />
      {query && (
        <div className="value-options" role="listbox">
          {matches.map((value) => (
            <button type="button" role="option" aria-selected="false" key={value} onClick={() => add(value)}>{value}</button>
          ))}
          {!matches.some((value) => value.toLowerCase() === query.trim().toLowerCase()) && (
            <button type="button" role="option" aria-selected="false" onClick={() => add(query)}>Create “{query.trim()}”</button>
          )}
        </div>
      )}
    </div>
  );
}
