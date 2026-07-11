import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TargetHandleSuggestion } from '../shared/target-handle-suggestions';

interface TargetHandleComboboxProps {
  value: string;
  suggestions: TargetHandleSuggestion[];
  onChange: (value: string) => void;
}

export function TargetHandleCombobox({ value, suggestions, onChange }: TargetHandleComboboxProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const expanded = open && suggestions.length > 0;

  useEffect(() => {
    setHighlighted(-1);
  }, [suggestions]);

  function selectSuggestion(suggestion: TargetHandleSuggestion) {
    onChange(`@${suggestion.handle}`);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => current < suggestions.length - 1 ? current + 1 : 0);
      return;
    }

    if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => current > 0 ? current - 1 : suggestions.length - 1);
      return;
    }

    if (event.key === 'Enter' && expanded && highlighted >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlighted]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setHighlighted(-1);
    }
  }

  return (
    <div className="target-handle-combobox">
      <input
        aria-label="Other person's X handle"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined}
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder="@their_handle"
      />
      {expanded && (
        <div className="target-handle-options" id={listboxId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <div
              className={index === highlighted ? 'target-handle-option highlighted' : 'target-handle-option'}
              id={`${listboxId}-option-${index}`}
              key={suggestion.handle}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
            >
              <span className="target-handle-option-main">
                <strong>{suggestion.displayName ?? `@${suggestion.handle}`}</strong>
                {suggestion.displayName && <small>@{suggestion.handle}</small>}
              </span>
              <span className="target-handle-option-meta">
                {suggestion.companyName && <small>{suggestion.companyName}</small>}
                {suggestion.recent && <small className="recent-marker">Recent</small>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
