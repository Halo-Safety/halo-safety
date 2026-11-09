import type { CaseClassification, CaseStatus, CorrectiveAction } from './safetyApi';

/** Shared rules for persistent safety cases. Device and simulator records are independent. */
export function validateCaseWorkflow(
  classification: CaseClassification,
  status: CaseStatus,
  actionStatuses: readonly CorrectiveAction['status'][],
): string | null {
  if (classification === 'false_alarm') {
    if (status !== 'dismissed') return 'Classify a false alarm as Dismissed.';
    if (actionStatuses.some(value => value !== 'completed')) return 'Complete existing actions before dismissing this case.';
    return null;
  }
  if (status === 'dismissed') return 'Dismissed is reserved for false alarms.';
  if (classification === 'candidate' && !['needs_review', 'investigating'].includes(status))
    return 'Classify the observation before assigning actions or closing the case.';
  if (['action_assigned', 'monitoring', 'closed'].includes(status) && !actionStatuses.length)
    return 'Create a corrective action before advancing the case.';
  if (['monitoring', 'closed'].includes(status) && actionStatuses.some(value => value !== 'completed'))
    return 'Complete all corrective actions before monitoring or closing the case.';
  return null;
}

export function validateActionUpdate(
  classification: CaseClassification, caseStatus: CaseStatus,
  updatedStatus: CorrectiveAction['status'],
): string | null {
  if (classification === 'false_alarm') return 'Dismissed false alarms cannot have new corrective work.';
  if (['monitoring', 'closed'].includes(caseStatus) && updatedStatus !== 'completed')
    return 'Reopen the case before assigning unfinished corrective work.';
  return null;
}
