export default function PageStateCard({ eyebrow, title, message, action, className = '' }) {
  return (
    <article className={`page-state-card panel ${className}`.trim()}>
      <div className="page-state-icon" aria-hidden="true" />
      <div className="page-state-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
        {message ? <p>{message}</p> : null}
      </div>
      {action ? <div className="page-state-action">{action}</div> : null}
    </article>
  )
}
