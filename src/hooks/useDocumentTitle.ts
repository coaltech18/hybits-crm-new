import { useEffect } from 'react';

// ================================================================
// DOCUMENT TITLE HOOK
// ================================================================
// Sets the browser tab title for the current page.
// Appends " | Hybits CRM" suffix for brand consistency.
// 
// Usage: useDocumentTitle('Dashboard');
//        → Tab shows "Dashboard | Hybits CRM"
// ================================================================

const APP_NAME = 'Hybits CRM';

/**
 * Hook to set the document title for the current page.
 * @param title - Page title (e.g., "Dashboard", "Invoices")
 * @param options - Optional configuration
 */
export function useDocumentTitle(
    title: string,
    options?: {
        suffix?: string | false; // Custom suffix or false to disable
    }
) {
    const suffix = options?.suffix === false ? '' : (options?.suffix ?? APP_NAME);

    useEffect(() => {
        const fullTitle = suffix ? `${title} | ${suffix}` : title;
        document.title = fullTitle;

        // Cleanup: restore default title on unmount (optional)
        return () => {
            document.title = APP_NAME;
        };
    }, [title, suffix]);
}
