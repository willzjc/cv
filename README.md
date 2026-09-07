# Will Chen CV

Open [index.html](index.html) directly in a browser. No build or development server is required.

## Browser Presentation

On the first visit, a 1.6-second name reveal fades away to the original CV. There are no additional dashboard sections or persistent intro controls. The animation uses CSS and does not depend on visualization libraries.

The browser remembers the visit in `localStorage` under `will-chen-intro-seen-v1`. Reloads and later visits go straight to the CV. When local storage is unavailable, session storage prevents repeats in that session; when neither works, the intro is skipped. Reduced-motion preferences, printing and direct section links also skip it. To preview it again, remove only that key in browser developer tools or use a fresh browser profile.

Clicking, tapping, scrolling or using the keyboard dismisses the animation immediately without blocking the action. It is hidden from assistive technology, never locks scrolling, and has a timeout fallback. The name and headline come from the current CV, including saved edits.

The intro lives outside `#resume` and is excluded from print with `data-screen-only`. It does not change document layout or export behavior. Word export reads the technical leadership heading and copy from the CV so edited wording stays consistent. HTML downloads reset the transient animation state without exporting the visitor's first-visit flag.

Existing project visuals, icons, fonts and Word generation still use their D3, Lucide, Google Fonts and docx CDNs. No build or development server is required.

## Verification

Development dependencies are used only by the tests. Use Node.js 20.6 or newer:

```sh
npm ci --ignore-scripts
npm test
```

The suite checks first and repeat visits, storage fallbacks, dismissal, reduced motion, library failures, HTML download/reopen behavior, saved-copy migration, export isolation and actual DOCX content. The document contract hashes guard the approved CV and exporters; update them only when making intentional document changes.

DOM tests simulate animation completion, not rendered frames. Desktop/mobile visual inspection and an actual Print to PDF preview remain separate checks.