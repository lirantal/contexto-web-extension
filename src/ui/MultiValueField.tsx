import React, { useEffect, useId, useMemo, useState } from 'react';

export interface MultiValueFieldProps {
  label: 'Tags' | 'Circles';
  values: string[];
  suggestions: string[];
  onChange(values: string[]): void;
  disabled?: boolean;
  query?: string;
  onQueryChange?(query: string): void;
}

export function MultiValueField({ label, values, suggestions, onChange, disabled, query: controlledQuery, onQueryChange }: MultiValueFieldProps) {
  const listboxId = useId();
  const [localQuery, setLocalQuery] = useState('');
  const query = controlledQuery ?? localQuery;
  function setQuery(value: string) {
    setLocalQuery(value);
    onQueryChange?.(value);
  }
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const normalized = useMemo(() => new Set(values.map((value) => value.toLowerCase())), [values]);
  const matches = suggestions.filter((value) =>
    !normalized.has(value.toLowerCase()) && value.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const hasQuery = Boolean(query.trim());
  const expanded = !disabled && open && hasQuery && matches.length > 0;

  useEffect(() => {
    setHighlighted(-1);
  }, [suggestions, values]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setHighlighted(-1);
    }
  }, [disabled]);

  useEffect(() => {
    if (expanded && highlighted >= 0) {
      document.getElementById(`${listboxId}-option-${highlighted}`)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [expanded, highlighted, listboxId]);

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || normalized.has(trimmed.toLowerCase())) return;
    onChange([...values, trimmed]);
    setQuery('');
    setOpen(false);
    setHighlighted(-1);
  }

  return (
    <div className="multi-value-field">
      <label htmlFor={`contexto-${label.toLowerCase()}`}>{label}</label>
      <div className="chip-row">
        {values.map((value) => (
          <span className={`chip ${label === 'Circles' ? 'folder-chip' : ''}`} key={value.toLowerCase()}>
            {value}
            <button type="button" disabled={disabled} aria-label={`Remove ${value} from ${label}`}
              onClick={() => onChange(values.filter((item) => item !== value))}>×</button>
          </span>
        ))}
      </div>
      <input id={`contexto-${label.toLowerCase()}`} value={query} disabled={disabled}
        autoComplete="off" role="combobox" aria-autocomplete="list"
        aria-expanded={expanded} aria-controls={listboxId}
        aria-activedescendant={expanded && highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onBlur={() => { setOpen(false); setHighlighted(-1); }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && hasQuery && matches.length) {
            event.preventDefault();
            setOpen(true);
            setHighlighted((current) => current < matches.length - 1 ? current + 1 : 0);
          } else if (event.key === 'ArrowUp' && hasQuery && matches.length) {
            event.preventDefault();
            setOpen(true);
            setHighlighted((current) => current > 0 ? current - 1 : matches.length - 1);
          } else if (event.key === 'Enter' && expanded && highlighted >= 0 && matches[highlighted]) {
            event.preventDefault();
            add(matches[highlighted]);
          } else if (event.key === 'Enter' && hasQuery) {
            event.preventDefault();
            add(query);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
            setHighlighted(-1);
          }
        }} />
      {expanded && (
        <div className="value-options" id={listboxId} role="listbox">
          {matches.map((value, index) => (
            <button type="button" className={index === highlighted ? 'value-option highlighted' : 'value-option'}
              role="option" aria-selected={index === highlighted}
              id={`${listboxId}-option-${index}`} key={value}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(value)}>{value}</button>
          ))}
        </div>
      )}
    </div>
  );
}
