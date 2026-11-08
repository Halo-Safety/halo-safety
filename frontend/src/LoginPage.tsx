import { ArrowRight, LockKeyhole, Mail, Pause, Play, ShieldCheck, Sparkles } from 'lucide-react';

type Props = {
  onContinue: () => void;
  motionEnabled: boolean;
  onMotionChange: () => void;
};

export default function LoginPage({ onContinue, motionEnabled, onMotionChange }: Props) {
  return (
    <main className="login-screen">
      <header className="login-site-header">
        <a href="#welcome" className="login-site-brand" aria-label="Halo homepage">
          <span className="login-site-symbol"><ShieldCheck size={20} strokeWidth={1.8} /></span>
          <span>halo<span className="login-brand-dot">.</span></span>
        </a>
        <div className="login-site-meta">
          <span className="login-site-status"><span /> SYSTEMS ONLINE · DEMO</span>
          <span className="login-site-version">HALO / 01</span>
        </div>
      </header>

      <div className="login-content" id="welcome">
        <div className="login-story">
          <div className="login-overline"><span className="login-overline-line" /> SAFETY, MADE VISIBLE</div>
          <h1>See the signals.<br/><em>Shape the future.</em></h1>
          <p>One workspace for proximity signals, near-miss investigation, and clearer operational decisions.</p>
          <div className="login-story-footer">
            <div className="login-story-stat"><span>01</span><strong>Monitor</strong><small>Capture safety signals</small></div>
            <div className="login-story-stat"><span>02</span><strong>Understand</strong><small>Connect events to context</small></div>
            <div className="login-story-stat"><span>03</span><strong>Improve</strong><small>Turn insight into action</small></div>
          </div>
        </div>

        <section className="login-card" aria-labelledby="login-card-heading">
          <div className="login-card-top">
            <span className="login-card-icon"><ShieldCheck size={22} strokeWidth={1.8}/></span>
            <span className="login-card-indicator"><span /> WORKSPACE ACCESS</span>
          </div>
          <div className="login-card-heading">
            <span className="login-card-kicker">WELCOME TO HALO</span>
            <h2 id="login-card-heading">Welcome back<span>.</span></h2>
            <p>Sign in to your safety intelligence workspace.</p>
          </div>

          <div className="login-fields" aria-label="Future account sign-in preview">
            <div className="login-fields-caption"><span>ACCOUNT SIGN-IN</span><span>COMING SOON</span></div>
            <label htmlFor="halo-email-preview">Work email</label>
            <div className="login-field-disabled">
              <Mail size={17} />
              <input id="halo-email-preview" type="email" placeholder="name@company.com" autoComplete="off" disabled />
            </div>
            <label htmlFor="halo-password-preview">Password</label>
            <div className="login-field-disabled">
              <LockKeyhole size={17} />
              <input id="halo-password-preview" type="password" placeholder="••••••••" autoComplete="off" disabled />
            </div>
          </div>

          <div className="login-demo-section">
            <p><Sparkles size={15}/> For now, explore Halo with a demo workspace.</p>
            <button className="login-demo-button" type="button" onClick={onContinue}>
              Enter demo workspace <ArrowRight size={18} />
            </button>
            <span>No password required. Demo access does not authenticate an account.</span>
          </div>

          <div className="login-card-footer">
            <ShieldCheck size={16}/>
            <span>Prototype environment · simulated data</span>
          </div>
        </section>
      </div>

      <footer className="login-site-footer">
        <span>© HALO SAFETY · PROTOTYPE</span>
        <span className="login-footer-center">INTELLIGENCE FOR SAFER WORKPLACES</span>
        <button type="button" className="login-motion-toggle" aria-pressed={motionEnabled} onClick={onMotionChange}>
          {motionEnabled ? <Pause size={14}/> : <Play size={14}/>}
          {motionEnabled ? 'Pause motion' : 'Play motion'}
        </button>
      </footer>
    </main>
  );
}
