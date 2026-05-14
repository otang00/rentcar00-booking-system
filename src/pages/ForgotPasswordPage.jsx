import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { isSupabaseClientReady, supabase } from '../lib/supabaseClient'

function resolveResetRedirect(search) {
  const params = new URLSearchParams(search)
  const redirectTo = params.get('redirectTo') || '/cars'
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/cars'
  return `${window.location.origin}/reset-password?redirectTo=${encodeURIComponent(safeRedirect)}`
}

export default function ForgotPasswordPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const resetRedirectTo = useMemo(() => resolveResetRedirect(location.search), [location.search])

  async function handleSubmit(event) {
    event.preventDefault()

    if (!supabase || !isSupabaseClientReady) {
      setErrorMessage('Supabase 설정이 준비되지 않았습니다.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirectTo,
    })

    if (error) {
      setErrorMessage(error.message || '재설정 링크 발송에 실패했습니다.')
      setSubmitting(false)
      return
    }

    setSuccessMessage('재설정 링크를 발송했습니다. 메일함을 확인해주세요.')
    setSubmitting(false)
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0 }}>비밀번호 재설정</h1>
              <p className="small-note" style={{ marginTop: 8 }}>
                가입한 이메일로 비밀번호 재설정 링크를 보냅니다.
              </p>
            </div>

            <form className="stack-form stack-form-centered" onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="forgot-password-email">이메일</label>
                <input
                  id="forgot-password-email"
                  className="field-input"
                  type="email"
                  autoComplete="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting || !isSupabaseClientReady}
                  required
                />
              </div>

              {errorMessage ? <p className="field-note" style={{ color: '#be123c' }}>{errorMessage}</p> : null}
              {successMessage ? <p className="field-note" style={{ color: '#166534' }}>{successMessage}</p> : null}

              <button className="btn btn-dark btn-md btn-block" type="submit" disabled={submitting || !isSupabaseClientReady}>
                {submitting ? '발송 중...' : '재설정 링크 보내기'}
              </button>
            </form>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn-outline btn-md" to="/login">로그인으로</Link>
              <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
