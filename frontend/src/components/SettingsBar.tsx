import { useState, useEffect } from 'react';
import { getModelSize, setModelSize } from '../api/client';

const LANGUAGES = [
  { value: '', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

interface Props {
  lang: string;
  onLangChange: (lang: string) => void;
}

export function SettingsBar({ lang, onLangChange }: Props) {
  const [model, setModel] = useState('base');

  useEffect(() => {
    getModelSize().then(setModel).catch(() => {});
  }, []);

  const handleModelChange = async (size: string) => {
    setModel(size);
    await setModelSize(size).catch(() => {});
  };

  return (
    <div className="flex gap-3 items-center flex-wrap">
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        Model
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="bg-bg-tertiary text-text-primary border border-bg-tertiary rounded px-2 py-1 text-sm"
        >
          <option value="base">Base (fast)</option>
          <option value="small">Small</option>
          <option value="medium">Medium (accurate)</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        Language
        <select
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          className="bg-bg-tertiary text-text-primary border border-bg-tertiary rounded px-2 py-1 text-sm"
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export { LANGUAGES };
