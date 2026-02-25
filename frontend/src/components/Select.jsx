import { useEffect, useMemo, useRef, useState } from 'react';

export default function Select({
  value,
  options,
  onChange,
  placeholder = 'Select',
  direction = 'down',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find(option => option.value === value),
    [options, value]
  );

  useEffect(() => {
    const handleClick = event => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = optionValue => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div className="custom-select-wrapper" ref={wrapperRef}>
      <div className={`custom-select ${direction === 'up' ? 'select-up' : 'select-down'}`}>
        <button
          type="button"
          className={`select-trigger ${open ? 'active' : ''}`}
          onClick={() => setOpen(prev => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          {selectedOption?.label || placeholder}
        </button>
        <ul className={`select-options ${open ? 'show' : ''}`} role="listbox">
          {options.map(option => (
            <li
              key={`${option.value}-${option.label}`}
              className={`select-option ${option.value === value ? 'selected' : ''}`}
              role="option"
              aria-selected={option.value === value}
              tabIndex={0}
              onClick={() => handleSelect(option.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(option.value);
                }
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
