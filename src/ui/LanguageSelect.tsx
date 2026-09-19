import { useTranslation } from '../i18n';
export function LanguageSelect() {
  const { t, locale, setLocale } = useTranslation();
  return <label class="language-select"><span>{t('common.language')}</span>
    <select aria-label={t('common.language')} value={locale} onChange={event => setLocale(event.currentTarget.value as 'ko' | 'en')}>
      <option value="ko" lang="ko">한국어</option><option value="en" lang="en">English</option>
    </select>
  </label>;
}
