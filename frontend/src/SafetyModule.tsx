import SafetyWorkspace from './SafetyWorkspace';
import SafetyRecords from './SafetyRecords';
import type { DemoCase, DemoReviewInput } from './demoSafetyData';

type Props = {
  view: 'cases' | 'vehicles';
  isDemoAccount: boolean;
  sessionCases?: DemoCase[];
  preferredCaseId?: string;
  onReviewCase?: (caseId: string, input: DemoReviewInput) => void;
};

/**
 * The invited demo account has an isolated fictional walkthrough; regular
 * organization accounts use Supabase records. No redundant in-page mode tabs.
 */
export default function SafetyModule({ view, isDemoAccount, sessionCases, preferredCaseId, onReviewCase }: Props) {
  return isDemoAccount
    ? <SafetyWorkspace view={view} isDemoAccount sessionCases={sessionCases}
        preferredCaseId={preferredCaseId} onReviewCase={onReviewCase}/>
    : <SafetyRecords view={view}/>;
}
