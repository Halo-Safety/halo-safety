import { useState } from 'react';
import SafetyWorkspace from './SafetyWorkspace';
import SafetyRecords from './SafetyRecords';
import type { DemoCase } from './demoSafetyData';

type Props = {
  view: 'cases' | 'vehicles';
  isDemoAccount: boolean;
  sessionCases?: DemoCase[];
  preferredCaseId?: string;
  onAddDemoAction?: (caseId: string) => void;
};

export default function SafetyModule({ view, isDemoAccount, sessionCases, preferredCaseId, onAddDemoAction }: Props) {
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
      ? <SafetyWorkspace view={view} isDemoAccount={true} sessionCases={sessionCases} preferredCaseId={preferredCaseId} onAddDemoAction={onAddDemoAction}/>
      : <SafetyRecords view={view} />}
  </>;
}
