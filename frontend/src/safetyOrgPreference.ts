/** Keep the organization used by Cases/Overview consistent across navigation. */
const KEY = 'halo_safety_selected_org';

export function getSelectedSafetyOrg(): string | null {
  try { return window.sessionStorage.getItem(KEY); }
  catch { return null; }
}
export function rememberSelectedSafetyOrg(id: string): void {
  try { window.sessionStorage.setItem(KEY, id); }
  catch { /* Browser storage may be disabled; current page still works. */ }
}
