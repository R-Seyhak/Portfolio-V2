'use client';

import { useState } from 'react';
import emailjs from '@emailjs/browser';
import { PORTFOLIO } from '../data.js';
import { useReveal, Icon, cn } from './primitives.jsx';
import { useLiveWhileVisible } from './motion.js';

const SERVICE_ID  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

/** A small folded-paper plane beside the heading; it takes off when a message is sent. */
function PaperPlane({ flying }) {
  const ref = useLiveWhileVisible();
  return (
    <span className="ct-plane" ref={ref} data-flying={flying ? '' : undefined} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <path className="ct-plane-a" d="M58 6 6 27l18 10Z" />
        <path className="ct-plane-b" d="M58 6 24 37l17 19Z" />
        <path className="ct-plane-c" d="M58 6 24 37l2 15 7-8Z" />
      </svg>
    </span>
  );
}

export function Contact() {
  const { person } = PORTFOLIO;
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const ref = useReveal();

  const errors = {
    name:    form.name.trim().length < 2     ? 'At least 2 characters' : null,
    email:   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? null : 'Invalid email',
    message: form.message.trim().length < 10 ? 'At least 10 characters' : null,
  };
  const valid = !errors.name && !errors.email && !errors.message;

  async function submit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });
    if (!valid) {
      const first = ['name', 'email', 'message'].find((k) => errors[k]);
      e.currentTarget.elements.namedItem(first)?.focus();
      return;
    }

    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      setErrorMsg('Email service is not configured.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    setErrorMsg('');
    try {
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          from_name: form.name,
          from_email: form.email,
          reply_to: form.email,
          message: form.message,
          to_email: person.email,
        },
        { publicKey: PUBLIC_KEY }
      );
      setStatus('sent');
      setTimeout(() => {
        setStatus('idle');
        setForm({ name: '', email: '', message: '' });
        setTouched({});
      }, 2600);
    } catch (err) {
      setErrorMsg(err?.text || err?.message || 'Failed to send. Please try again.');
      setStatus('error');
    }
  }

  function copyEmail() {
    navigator.clipboard && navigator.clipboard.writeText(person.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section id="contact" className="py-[var(--section-y)] relative bg-bg">
      <div className="section-container">
        <div className="section-header">
          <div className="font-display italic text-[15px] text-ink-3">/ 06 · contact</div>
          <div>
            <h2 className="font-display font-medium text-ink tracking-[-0.025em] leading-none" style={{ fontSize: 'clamp(36px,5.5vw,64px)' }}>
              Let's make something<br />together.<PaperPlane flying={status === 'sent'} />
            </h2>
            <p className="mt-3.5 max-w-[560px] text-ink-2 text-[15px] leading-relaxed">
              Internships, side projects, or a friendly hello — all welcome.
            </p>
          </div>
        </div>

        <div className="contact-grid reveal" ref={ref}>
          <div>
            <p className="text-[17px] leading-relaxed text-ink-2">
              I'm always open to new opportunities, collaborations, or just a chat about design and engineering.
              Reach me via the form — or skip it and email me directly.
            </p>
            <button
              type="button"
              aria-label={copied ? 'Email address copied' : `Copy email address ${person.email}`}
              className="ct-copy mt-7 flex items-center gap-2.5 px-[18px] py-3.5 border border-line rounded-[12px] bg-bg-2 cursor-pointer font-display italic text-[15px] sm:text-[16px] w-full sm:w-fit max-w-full hover:border-ink-3 hover:bg-bg-3"
              onClick={copyEmail}
            >
              <Icon.mail />
              <span className="truncate">{person.email}</span>
              {copied
                ? <span className="ml-1.5 text-[12px] flex items-center gap-1 flex-shrink-0" style={{ color: 'oklch(62% 0.15 150)' }}><Icon.check /> copied</span>
                : <span className="flex-shrink-0"><Icon.copy /></span>
              }
            </button>

            <div className="mt-[22px] flex flex-col gap-0.5 text-[14px] text-ink-2">
              <span className="font-display italic text-[13.5px] text-ink-3 mt-3">Elsewhere</span>
              <a href={person.github}  target="_blank" rel="noreferrer" className="ct-social hover:text-ink">↗ github.com/R-Seyhak</a>
              <a href={person.linkedin} target="_blank" rel="noreferrer" className="ct-social hover:text-ink">↗ linkedin / seyhak-rith-wk</a>
              <span className="font-display italic text-[13.5px] text-ink-3 mt-3">Timezone</span>
              <span>ICT (UTC+7) · replies within ~24h</span>
            </div>
          </div>

          <form
            className="border border-line rounded-design-lg p-5 sm:p-7 bg-bg flex flex-col gap-[18px]"
            onSubmit={submit}
            aria-label="Contact form"
          >
            {[
              { id: 'name', label: 'Name', type: 'text', placeholder: 'How should I address you?', rows: undefined, autoComplete: 'name' },
              { id: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com', rows: undefined, autoComplete: 'email' },
              { id: 'message', label: 'Message', type: 'textarea', placeholder: 'Tell me about the project, role, or idea…', rows: 5 },
            ].map(({ id, label, type, placeholder, rows, autoComplete }) => {
              const invalid = Boolean(touched[id] && errors[id]);
              const field = {
                id: `contact-${id}`,
                name: id,
                className: 'ct-input',
                value: form[id],
                placeholder,
                'aria-required': true,
                'aria-invalid': invalid || undefined,
                'aria-describedby': `contact-${id}-hint`,
                onChange: (e) => setForm({ ...form, [id]: e.target.value }),
                onBlur: () => setTouched({ ...touched, [id]: true }),
              };
              return (
                <div key={id} className="ct-field flex flex-col gap-2 relative" data-state={invalid ? 'error' : form[id] && !errors[id] ? 'ok' : undefined}>
                  <label htmlFor={field.id} className="font-display italic text-[13.5px] text-ink-3">
                    {label} <span className="text-accent" aria-hidden="true">*</span>
                  </label>
                  {type === 'textarea'
                    ? <textarea rows={rows} {...field} />
                    : <input type={type} autoComplete={autoComplete} {...field} />
                  }
                  <div id={`contact-${id}-hint`} className="font-display italic text-[13.5px] text-ink-3 flex justify-between">
                    <span>{id === 'message' ? `${form.message.length} chars` : ' '}</span>
                    {invalid
                      ? <span className="ct-msg-error">× {errors[id]}</span>
                      : form[id] && !errors[id] && <span className="ct-msg-ok">✓ {id === 'message' ? 'ready' : id === 'email' ? 'valid' : 'looks good'}</span>
                    }
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
              <span className="font-display italic text-[13.5px] text-ink-3" role="status" aria-live="polite">
                {status === 'error' && <span className="ct-msg-error">× {errorMsg}</span>}
                {status === 'sending' && 'Sending your message…'}
                {status === 'sent' && <span className="ct-msg-ok">✓ Message sent · I reply within ~24h</span>}
                {status === 'idle' && 'Enter ↵ to send · never shared'}
              </span>
              <button
                type="submit"
                className={cn(
                  'ct-submit inline-flex items-center justify-center gap-2.5 px-[22px] py-3.5 bg-ink text-bg rounded-[10px] text-[14px] font-medium min-w-[180px] w-full sm:w-auto',
                  status === 'sent' && 'submit-btn-sent'
                )}
                data-status={status}
                aria-busy={status === 'sending'}
                disabled={status === 'sending' || status === 'sent'}
              >
                {(status === 'idle' || status === 'error') && <>Send message <Icon.arrow /></>}
                {status === 'sending' && <><span className="ct-spinner" aria-hidden="true" />Sending</>}
                {status === 'sent'    && <><Icon.check /> Sent — thanks</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="section-container">
        <div className="mt-20 border-t border-line pt-10 pb-7">
          <div className="footer-grid">
            <div>
              <div className="font-display text-[32px] font-medium tracking-[-0.02em]">Rith Seyhak.</div>
              <p className="mt-2.5 text-ink-2 text-[14px] leading-relaxed max-w-[320px]">
                Aspiring software engineer based in Phnom Penh, Cambodia. Building clean, modern web &amp; mobile applications.
              </p>
            </div>
            <div>
              <h5 className="font-display italic text-[13.5px] text-ink-3 mb-3.5">Navigate</h5>
              <ul className="list-none flex flex-col gap-2">
                {['home', 'about', 'skills', 'projects', 'experience', 'contact'].map((id) => (
                  <li key={id}><a href={`#${id}`} className="text-[14px] text-ink-2 transition-colors hover:text-ink capitalize">{id === 'projects' ? 'Work' : id === 'experience' ? 'Path' : id.charAt(0).toUpperCase() + id.slice(1)}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="font-display italic text-[13.5px] text-ink-3 mb-3.5">Elsewhere</h5>
              <ul className="list-none flex flex-col gap-2">
                <li><a href={person.github}  target="_blank" rel="noreferrer" className="text-[14px] text-ink-2 transition-colors hover:text-ink">GitHub ↗</a></li>
                <li><a href={person.linkedin} target="_blank" rel="noreferrer" className="text-[14px] text-ink-2 transition-colors hover:text-ink">LinkedIn ↗</a></li>
                <li><a href={`mailto:${person.email}`} className="text-[14px] text-ink-2 transition-colors hover:text-ink">Email ↗</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-5 border-t border-line flex justify-between flex-wrap gap-2 font-display italic text-[13.5px] text-ink-3">
            <span>© {new Date().getFullYear()} Rith Seyhak · All rights reserved</span>
            <span>Built with care · Phnom Penh, KH</span>
          </div>
        </div>
      </div>
    </section>
  );
}
