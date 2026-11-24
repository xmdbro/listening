export function CardOptions<Value extends string>({ legend, name, options, value, onChange, children }: {
  legend: string;
  name: string;
  options: Record<Value, string>;
  value: Value;
  onChange: (value: Value) => void;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="share-fieldset">
      <legend>{legend}</legend>
      <div className="share-option-grid">
        {(Object.keys(options) as Value[]).map((option) => (
          <label key={option}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            {options[option]}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
