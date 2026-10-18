import React, { useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { rankFuzzyTextSuggestions } from '../shared/fuzzy-text-suggestions';

export interface LocationComboboxProps {
  value: string;
  suggestions: string[];
  onChange(value: string): void;
  disabled?: boolean;
}

export function LocationCombobox({
  value,
  suggestions,
  onChange,
  disabled = false,
}: LocationComboboxProps) {
  const inputId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const matches = useMemo(
    () => rankFuzzyTextSuggestions(suggestions, value),
    [suggestions, value],
  );
  const hasQuery = Boolean(value.trim());
  const expanded = !disabled && open && hasQuery && matches.length > 0;

  useEffect(() => {
    setHighlighted(-1);
  }, [suggestions]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setHighlighted(-1);
    }
  }, [disabled]);

  useEffect(() => {
    if (expanded && highlighted >= 0) {
      document.getElementById(`${listboxId}-option-${highlighted}`)
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [expanded, highlighted, listboxId]);

  function selectLocation(location: string) {
    onChange(location);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && hasQuery && matches.length) {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => current < matches.length - 1 ? current + 1 : 0);
    } else if (event.key === 'ArrowUp' && hasQuery && matches.length) {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => current > 0 ? current - 1 : matches.length - 1);
    } else if (event.key === 'Enter' && expanded && highlighted >= 0) {
      event.preventDefault();
      selectLocation(matches[highlighted]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setHighlighted(-1);
    }
  }

  return (
    <div className="location-combobox">
      <label htmlFor={inputId}>Location</label>
      <input
        id={inputId}
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={
          expanded && highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined
        }
        onFocus={() => { if (hasQuery) setOpen(true); }}
        onBlur={() => {
          setOpen(false);
          setHighlighted(-1);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {expanded && (
        <div className="value-options" id={listboxId} role="listbox">
          {matches.map((location, index) => (
            <button
              type="button"
              className={index === highlighted ? 'value-option highlighted' : 'value-option'}
              id={`${listboxId}-option-${index}`}
              key={location.toLocaleLowerCase()}
              role="option"
              aria-selected={index === highlighted}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectLocation(location)}
            >
              {location}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
