import { useId } from "react"
import styled from "@emotion/styled"
import useColorTheme from "src/hooks/useColorTheme"

export default function ThemePicker() {
  const { preference, theme, themes, setTheme } = useColorTheme()
  const id = useId()
  return (
    <Picker>
      <label htmlFor={id}>Color Theme</label>
      <select id={id} value={preference} onChange={(event) => setTheme(event.target.value)} aria-describedby={`${id}-description`}>
        {themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        <option value="system">System (Dark / Light Modern)</option>
      </select>
      <p id={`${id}-description`}>
        {preference === "system" ? `Follows your device · ${theme.label}` : `${theme.scheme === "dark" ? "Dark" : "Light"} appearance`}
        <span>Saved on this browser when local storage is available.</span>
      </p>
      <div className="theme-preview" aria-hidden="true">
        <span className="preview-keyword">const</span>{" "}
        <span className="preview-variable">theme</span>{" "}={" "}
        <span className="preview-string">{JSON.stringify(theme.label)}</span>
      </div>
    </Picker>
  )
}

const Picker = styled.div`
  display: grid;
  gap: 8px;
  min-width: 0;
  font-family: var(--font-ui);
  font-size: 13px;
  label { color: var(--editor-fg2); font-weight: 600; }
  select {
    width: 100%;
    min-height: 30px;
    border: 1px solid var(--editor-line2);
    border-radius: 2px;
    background: var(--editor-bg3);
    color: var(--editor-fg);
    font: inherit;
    padding: 4px 8px;
    cursor: pointer;
  }
  p { margin: 0; color: var(--editor-fg3); font-size: 12px; line-height: 1.5; }
  p span { display: block; }
  .theme-preview {
    overflow-x: auto;
    background: var(--editor-bg);
    color: var(--editor-fg);
    border: 1px solid var(--editor-line);
    padding: 10px;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .preview-keyword { color: var(--syntax-keyword); }
  .preview-variable { color: var(--syntax-variable); }
  .preview-string { color: var(--syntax-string); }
`
