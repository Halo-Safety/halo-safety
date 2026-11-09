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

/**
 * The invited demo account has an isolated fictional walkthrough; regular
 * organization accounts use Supabase records. No redundant in-page mode tabs.
 */
export default function SafetyModule({ view, isDemoAccount, sessionCases, preferredCaseId, onAddDemoAction }: Props) {
  return isDemoAccount
    ? <SafetyWorkspace view={view} isDemoAccount sessionCases={sessionCases}
        preferredCaseId={preferredCaseId} onAddDemoAction={onAddDemoAction}/>
    : <SafetyRecords view={view}/>;
}
