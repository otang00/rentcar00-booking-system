import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseClientMissingEnv } from '../lib/supabaseClient'
import { buildAuthEmailAlias, formatPhoneNumber, normalizePhoneNumber } from '../utils/phone'

function resolveRedirectTo(search) {
  const params = new URLSearchParams(search)
  const redirectTo = params.get('redirectTo') || '/cars'
  return redirectTo.startsWith('/') ? redirectTo : '/cars'
}

function resolvePhone(search) {
  const params = new URLSearchParams(search)
  return formatPhoneNumber(params.get('phone') || '')
}

function isInvalidCredentialsError(error) {
  return Boolean(error?.message?.includes('Invalid login credentials'))
}

function getErrorMessage(error) {
  if (!error) return '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'
  if (isInvalidCredentialsError(error)) return '휴대폰 번호 또는 비밀번호가 올바르지 않습니다.'
  return error.message || '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, isAuthenticated, isSupabaseClientReady } = useAuth()
  const redirectTo = useMemo(() => resolveRedirectTo(location.search), [location.search])
  const [phone, setPhone] = useState(() => resolvePhone(location.search))
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showForgotPasswordLink, setShowForgotPasswordLink] = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [loading, isAuthenticated, navigate, redirectTo])

  async function handleSubmit(event) {
    event.preventDefault()

    if (!supabase || !isSupabaseClientReady) {
      setErrorMessage(`Supabase 설정이 준비되지 않았습니다. 누락: ${supabaseClientMissingEnv.join(', ') || 'unknown'}`)
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setShowForgotPasswordLink(false)

    const normalizedPhone = normalizePhoneNumber(phone)
    const authEmailAlias = buildAuthEmailAlias(normalizedPhone)

    if (!authEmailAlias) {
      setErrorMessage('휴대폰 번호 형식을 확인해 주세요.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmailAlias,
      password,
    })

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setShowForgotPasswordLink(isInvalidCredentialsError(error))
      setSubmitting(false)
      return
    }

    navigate(redirectTo, { replace: true })
  }

  return (
    <PageShell className="color-preview-shell color-preview-mockup-shell login-page-shell">
      <section className="section-bg login-page-section">
        <div className="container login-page-container">
          <article className="login-centered-shell">
            <div className="login-brand-mark"><img src="/bbang-wordmark.png" alt="빵빵카" /></div>

            <form className="login-form-card" onSubmit={handleSubmit}>
              <div className="login-input-stack">
                <div className="login-input-group">
                  <label className="login-input-label" htmlFor="login-phone">전화번호</label>
                  <input
                    id="login-phone"
                    className="login-line-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="전화번호"
                    value={phone}
                    onChange={(event) => setPhone(formatPhoneNumber(event.target.value))}
                    disabled={submitting || !isSupabaseClientReady}
                    required
                  />
                </div>

                <div className="login-input-group">
                  <label className="login-input-label" htmlFor="login-password">비밀번호</label>
                  <input
                    id="login-password"
                    className="login-line-input"
                    type="password"
                    autoComplete="current-password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting || !isSupabaseClientReady}
                    required
                  />
                </div>
              </div>

              {!isSupabaseClientReady ? (
                <p className="login-error-text">Supabase 설정이 준비되지 않았습니다. 누락: {supabaseClientMissingEnv.join(', ') || 'unknown'}</p>
              ) : null}
              {errorMessage ? <p className="login-error-text">{errorMessage}</p> : null}

              <button className="login-submit-button" type="submit" disabled={submitting || loading || !isSupabaseClientReady}>
                {submitting ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div className="login-bottom-links">
              {showForgotPasswordLink ? (
                <Link to={`/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}`}>비밀번호 찾기</Link>
              ) : (
                <span />
              )}
              <Link to={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}>회원가입</Link>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
