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

## Unlisted interactive card

[id-demo/index.html](id-demo/index.html) is a standalone, non-official personal card at
`https://willzjc.github.io/cv/id-demo/`. It does not change or link from the CV.
It is visibly labelled "Not valid identification", uses sample details and an
illustrated portrait, and ships without official branding or a verification QR code.

The presentation is card-first, with a full-width, flat black layout on phones
and a centred card on desktop. The centred portrait takes approximately 39% of
the card's width; subdued iridescent bands sit behind the name and two-column
details. The background is an original layered floral silhouette with separated
petals, not a reproduction of the official licence security artwork.
The left header phone icon toggles motion, and the three-dot button
opens the editor. Both controls have accessible labels and 44-pixel tap targets.
The non-official warning remains visible above the portrait and in the footer.

Use **Edit details** to change the name, birthdate, refreshed date/time, class
and conditions, select your own portrait and custom logo,
or insert a personal barcode/QR image (for example, a profile-link code, not an
official ID verification code). The card retains its non-official labels.
The **Refreshed** label is a manually selected preview timestamp, not evidence
of a server refresh or verification. It defaults to the local date/time when
the page opens and stays fixed until edited. Its calendar date and time are
displayed as entered, without timezone conversion. Class defaults to `C` and
conditions to `None`. All fields participate in saving, remembering and reset.
Previously saved cards without these fields receive the defaults while keeping
their existing name, birthdate and images.
**Custom logo** replaces the top-left `iD` mark with your own or an authorized
logo. Its native phone picker accepts PNG, WebP and JPG up to 5 MB. Logos are
resized proportionally to at most 600 pixels on the longest edge and saved as
lossless PNG, preserving PNG/WebP transparency without adding a white backing.
The editor uses a checkerboard preview to make transparency visible.
Removing the logo and saving restores the original mark. Remember/reset apply
to the logo just like the other images.
For an opaque-background logo, enable **Remove background colour**, select
the colour (black by default) and adjust **Tolerance** from 0 to 255.
A pixel becomes fully transparent when each of its red, green and blue channels
is within that tolerance of the selected colour. For black and tolerance 24,
RGB values from 0 through 24 in every channel are removed; 0 matches exactly.
Existing alpha is preserved on nonmatching pixels. This applies to all matching
pixels, not just the outer background, so matching details inside the logo can
also disappear.

The checkerboard preview updates as settings change. Changes apply to the card
only on **Save changes**. The unmodified, resized logo is retained so decreasing
tolerance or turning removal off restores pixels without uploading again.
Remembered cards retain this source and the settings for later editing; retaining
both versions may use more browser storage. Reset/removal clears them.
Photo and code pickers accept JPG, PNG and WebP files up to 5 MB each.
On a phone, the native **Choose file** buttons open the device's photo-library
or file chooser for each image independently. No camera capture is forced.
Use a JPG/PNG export or screenshot if an original HEIC photo is not offered
in a supported format by the phone's chooser.
Images are decoded and resized locally: portraits to at most 1200 pixels
and codes to at most 1600 pixels on the longest edge. Portraits use JPEG;
codes use lossless PNG and preserve their aspect ratio. Prepared images are
limited to 2 million data-URL characters each. Check a personal code with
your scanner after selecting it; this app does not validate its contents.

The editor shows previews, lets you remove either image, and applies image
changes only on **Save changes**. Closing the editor discards pending changes.
Changes last until reload
unless **Remember on this device** is selected. Remembered details are stored only
in this browser under `personal-card-details-v1`; **Reset details** removes that
key, removes all three images and restores the samples. Storage/quota failures are
reported in the editor; images are never uploaded to GitHub or another server.
The card has no external assets, analytics or upload endpoints. Do not put
personal details in source files: GitHub Pages and the repository are public.

On a phone, tap **Enable motion** and grant browser permission if prompted.
HTTPS (or localhost) is required. Device orientation drives the iridescent
background, with gravity/accelerometer events as a fallback where available.
If permission is denied or the browser delivers no data, the page explains
the problem and keeps pointer/horizontal-drag interaction available.
Vertical scrolling remains enabled. Motion is calibrated to the phone's
position when enabled, resets when screen orientation changes, pauses when
the page is hidden, and respects the device's Reduce Motion preference.
Desktop users can move the pointer over the card.

The page uses relative paths and needs no build. GitHub Pages currently
publishes the repository root from `main`; adding the `id-demo` folder publishes
the subpage without altering the existing CV. `noindex, nofollow` requests that
search engines do not index it, but it is **not private or password protected**.

For local browser checks:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
# Open http://127.0.0.1:4174/id-demo/
```

Run `node --test tests/digital-card.test.mjs` for the card's DOM and sensor
tests, or `npm test` for both the card and the existing CV regression tests.
Physical iPhone/Android sensor sensitivity and permission prompts should also
be checked on the deployed HTTPS page.