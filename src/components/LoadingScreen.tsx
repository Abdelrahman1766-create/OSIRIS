import { useTranslation } from 'react-i18next'

export default function LoadingScreen() {
  const { t } = useTranslation()
  return <div className="brand-loading" role="status" aria-live="polite"><span className="brand-loading-mark" aria-hidden="true">O</span><strong>OSIRIS</strong><small>{t('common.loading')}</small></div>
}
