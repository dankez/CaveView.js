export type NavCategory = 'project' | 'view' | 'layers' | 'analysis' | 'system'
export const NAV_REVEAL_EVENT = 'cv-nav-reveal'
export interface NavRevealDetail { category: NavCategory; target?: string }

export function revealInSidebar(category: NavCategory, target?: string) {
  window.dispatchEvent(new CustomEvent<NavRevealDetail>(NAV_REVEAL_EVENT, { detail: { category, target } }))
}
