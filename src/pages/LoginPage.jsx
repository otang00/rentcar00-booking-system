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
  const { loading, isAuthenticated, isSupabaseClientReady, user, profile } = useAuth()
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
      setShowForgotPasswordLink(false)
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
    <PageShell className="color-preview-shell color-preview-mockup-shell account-shell">
      <section className="section-bg account-page-shell">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel account-page-card">
            <div className="auth-hero-panel login-tone-hero">
              <span className="auth-hero-kicker">빵빵카</span>
              <h1>로그인</h1>
            </div>

            <div className="auth-content-grid">
              <div className="auth-main-card">
                <div className="auth-section-title">
                  <h2>계정 정보 입력</h2>
                </div>

                <form className="stack-form stack-form-centered account-form-grid" onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="login-phone">휴대폰 번호</label>
                <input
                  id="login-phone"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(event) => setPhone(formatPhoneNumber(event.target.value))}
                  disabled={submitting || !isSupabaseClientReady}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="login-password">비밀번호</label>
                <input
                  id="login-password"
                  className="field-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting || !isSupabaseClientReady}
                  required
                />
              </div>

              {!isSupabaseClientReady ? (
                <p className="field-note" style={{ color: '#be123c' }}>
                  Supabase 프론트 설정이 준비되지 않았습니다. 누락: {supabaseClientMissingEnv.join(', ') || 'unknown'}
                </p>
              ) : null}
              {errorMessage ? <p className="field-note" style={{ color: '#be123c' }}>{errorMessage}</p> : null}
              {showForgotPasswordLink ? (
                <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
                  <span className="field-note">비밀번호를 잊으셨나요?</span>
                  <Link
                    className="field-note"
                    style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline' }}
                    to={`/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}`}
                  >
                    비밀번호 재설정
                  </Link>
                </div>
              ) : null}

                  <button className="btn btn-dark btn-md btn-block" type="submit" disabled={submitting || loading || !isSupabaseClientReady}>
                    {submitting ? '로그인 중...' : '로그인'}
                  </button>
                </form>
              </div>

              <aside className="auth-side-card login-action-card">
                <Link className="btn btn-outline btn-md" to={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}>회원가입</Link>
                <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
              </aside>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
