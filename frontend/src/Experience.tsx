import { useState } from 'react';
import App from './App';
import GeometricBackground from './GeometricBackground';
import LoginPage from './LoginPage';

const DEMO_SESSION = 'halo-demo-workspace-session';

function readDemoSession(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO_SESSION) === 'active';
  } catch {
    return false;
  }
}

export default function Experience() {
  const [entered, setEntered] = useState(readDemoSession);
  const [motionEnabled, setMotionEnabled] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const toggleMotion = () => setMotionEnabled(enabled => !enabled);

  const enterDemo = () => {
    try { window.sessionStorage.setItem(DEMO_SESSION, 'active'); } catch { /* storage can be unavailable */ }
    setEntered(true);
  };

  const leaveDemo = () => {
    try { window.sessionStorage.removeItem(DEMO_SESSION); } catch { /* storage can be unavailable */ }
    setEntered(false);
  };

  return (
    <>
      <GeometricBackground paused={!motionEnabled}/>
      {entered ? (
        <App motionEnabled={motionEnabled} onMotionChange={toggleMotion} onExit={leaveDemo}/>
      ) : (
        <LoginPage onContinue={enterDemo} motionEnabled={motionEnabled} onMotionChange={toggleMotion}/>
      )}
    </>
  );
}
