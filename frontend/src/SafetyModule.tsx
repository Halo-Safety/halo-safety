import { useState } from 'react';
import SafetyWorkspace from './SafetyWorkspace';
import SafetyRecords from './SafetyRecords';

type Props = {
  view: 'cases' | 'vehicles';
  isDemoAccount: boolean;
};

export default function SafetyModule({ view, isDemoAccount }: Props) {
  const [mode, setMode] = useState<'sample' | 'cloud'>(isDemoAccount ? 'sample' : 'cloud');

  return <>
    {isDemoAccount && <div className="safety-mode-toggle" role="group" aria-label="Safety data mode">
      <button type="button" className={mode === 'sample' ? 'active' : ''}
        onClick={() => setMode('sample')}>Fictional demo walkthrough</button>
      <button type="button" className={mode === 'cloud' ? 'active' : ''}
        onClick={() => setMode('cloud')}>Organization records (Supabase)</button>
      <span>Demo records are never counted as real incidents.</span>
    </div>}
    {mode === 'sample' && isDemoAccount
      ? <SafetyWorkspace view={view} isDemoAccount={true} />
      : <SafetyRecords view={view} />}
  </>;
}
