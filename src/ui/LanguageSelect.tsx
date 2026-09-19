import { useTranslation } from '../i18n';
export function LanguageSelect() {
  const { t: translateLanguageLabel, locale: currentDisplayLocale, setLocale: updateDisplayLocale } = useTranslation();
  return <div class="language-select">
    <select aria-label={translateLanguageLabel('common.language')} value={currentDisplayLocale}
      onChange={languageChangeEvent => updateDisplayLocale(languageChangeEvent.currentTarget.value as 'ko' | 'en')}>
      <option value="ko" lang="ko">한국어</option><option value="en" lang="en">English</option>
    </select>
  </div>;
}
