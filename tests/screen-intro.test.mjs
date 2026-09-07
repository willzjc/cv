import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";
import { strFromU8, unzipSync } from "fflate";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const contract = JSON.parse(readFileSync(new URL("document-contract.json", import.meta.url), "utf8"));
const d3Source = readFileSync(new URL("../dist/d3.min.js", import.meta.resolve("d3")), "utf8");
const introKey = "will-chen-intro-seen-v1";

async function openFixture(options = {}) {
  let reducedMotion = options.reducedMotion ?? false;
  const errors = [];
  const imports = [];
  const downloads = [];
  const timers = [];
  const objectUrls = new Map();
  const mediaQueries = new Map();
  let downloadReady;
  let printCount = 0;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM(options.html ?? html, {
    url: options.url ?? "https://cv.example.test/",
    pretendToBeVisual: true,
    runScripts: "outside-only",
    virtualConsole
  });
  const { window } = dom;
  const { document } = window;
  for (const storageName of ["localStorage", "sessionStorage"]) {
    if (options.blockedStorage?.includes(storageName)) {
      Object.defineProperty(window, storageName, { get() { throw new window.DOMException("Storage unavailable", "SecurityError"); } });
    } else {
      Object.entries(options[storageName] ?? {}).forEach(([key, value]) => window[storageName].setItem(key, value));
    }
  }
  const setTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    timers.push({ callback, delay });
    return setTimeout(callback, delay, ...args);
  };
  window.matchMedia = (query) => {
    if (!mediaQueries.has(query)) {
      const media = new window.EventTarget();
      Object.defineProperty(media, "matches", {
        get: () => query.includes("prefers-reduced-motion") ? reducedMotion : query === "print" && Boolean(options.printMedia)
      });
      mediaQueries.set(query, media);
    }
    return mediaQueries.get(query);
  };
  window.Blob = Blob;
  window.URL.createObjectURL = (blob) => {
    const url = `blob:fixture-${objectUrls.size}`;
    objectUrls.set(url, blob);
    return url;
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    const download = { filename: this.download, blob: objectUrls.get(this.href) };
    downloads.push(download);
    downloadReady?.(download);
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.print = () => { printCount += 1; };
  window.confirm = () => true;
  if (!options.withoutD3) window.eval(d3Source);
  for (const script of document.querySelectorAll("script:not([src])")) {
    new vm.Script(script.textContent, {
      filename: script.id || "resume-script",
      importModuleDynamically: (specifier) => {
        const dependency = specifier.includes("docx@") ? import("docx") : Promise.reject(new Error(`Unexpected import: ${specifier}`));
        imports.push(dependency);
        return dependency;
      }
    }).runInContext(dom.getInternalVMContext());
  }
  await Promise.allSettled(imports);
  await new Promise(setImmediate);
  return {
    window, document, errors, downloads, timers,
    close: () => window.close(),
    get printCount() { return printCount; },
    finishAnimation() {
      const event = new window.Event("animationend", { bubbles: true });
      Object.defineProperty(event, "animationName", { value: "opening-exit" });
      document.querySelector("#opening-intro").dispatchEvent(event);
    },
    reduceMotion() {
      reducedMotion = true;
      window.matchMedia("(prefers-reduced-motion: reduce)").dispatchEvent(new window.Event("change"));
    },
    download(buttonId) {
      return new Promise((resolve) => {
        downloadReady = resolve;
        document.getElementById(buttonId).click();
      });
    }
  };
}

async function wordContent(blob) {
  const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const dom = new JSDOM(strFromU8(archive["word/document.xml"]), { contentType: "text/xml" });
  const document = dom.window.document;
  for (const hyperlink of document.getElementsByTagName("w:hyperlink")) hyperlink.setAttribute("r:id", "hyperlink");
  for (const numbering of document.getElementsByTagName("w:numId")) numbering.setAttribute("w:val", "list");
  const paragraphs = [...document.getElementsByTagName("w:p")].map((paragraph) =>
    [...paragraph.getElementsByTagName("w:t")].map((node) => node.textContent).join("")
  );
  const result = { xml: document.documentElement.outerHTML, paragraphs };
  dom.window.close();
  return result;
}

test("CV content, print styles and PDF/Word exporters match the approved document baseline", () => {
  const digest = (start, end) => {
    const startIndex = html.indexOf(start);
    const endIndex = html.indexOf(end, startIndex);
    assert.ok(startIndex >= 0 && endIndex > startIndex);
    return createHash("sha256").update(html.slice(startIndex, endIndex)).digest("hex");
  };
  assert.equal(digest('<main class="resume"', "</main>"), contract.resume);
  assert.equal(digest("  <style>", "  </style>"), contract.styles);
  assert.equal(digest("      async function buildWordDocument()", "      function renderProjectVisuals()"), contract.exporters);
});

test("dashboard removed; the intro is hidden by default, outside the CV and excluded from print", () => {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const intro = document.querySelector("#opening-intro");
  assert.equal(document.querySelectorAll("#engineering-impact, .impact-tab, .impact-node, #intro-career").length, 0);
  assert.equal(html.includes("@xyflow"), false);
  assert.equal(intro.hidden, true);
  assert.equal(intro.getAttribute("aria-hidden"), "true");
  assert.equal(intro.closest("#resume"), null);
  assert.equal(intro.querySelectorAll("[data-edit-id], .role, .project-card, .capability-list, button, a, [tabindex]").length, 0);
  const rules = [...document.querySelector("#screen-intro-styles").sheet.cssRules];
  const printRule = rules.find((rule) => rule.conditionText === "print").cssRules[0];
  assert.equal(printRule.selectorText, "[data-screen-only]");
  assert.equal(printRule.style.getPropertyValue("display"), "none");
  assert.equal(printRule.style.getPropertyPriority("display"), "important");
  for (const rule of rules) {
    assert.ok(rule.conditionText?.includes("screen") || rule.conditionText === "print" || rule.conditionText?.includes("prefers-reduced-motion"));
  }
  const screenRules = [...rules.find((rule) => rule.conditionText === "screen").cssRules];
  const overlay = screenRules.find((rule) => rule.selectorText === ".opening-intro");
  assert.equal(overlay.style.getPropertyValue("position"), "fixed");
  assert.equal(overlay.style.getPropertyValue("pointer-events"), "none");
  assert.equal(screenRules.find((rule) => rule.selectorText?.includes("body.is-ready .reveal")).style.getPropertyValue("animation"), "none");
  dom.window.close();
});

test("first visit plays the intro once; returning visits open the CV immediately", async (context) => {
  const first = await openFixture();
  context.after(first.close);
  assert.equal(first.document.querySelector("#opening-intro").hidden, false);
  assert.equal(first.document.querySelector("#opening-intro").classList.contains("is-playing"), true);
  assert.equal(first.window.localStorage.getItem(introKey), "1");
  first.finishAnimation();
  assert.equal(first.document.querySelector("#opening-intro").hidden, true);
  assert.equal(first.document.querySelector("#opening-intro").classList.contains("is-playing"), false);
  const returning = await openFixture({ localStorage: { [introKey]: first.window.localStorage.getItem(introKey) } });
  context.after(returning.close);
  assert.equal(returning.document.querySelector("#opening-intro").hidden, true);
  assert.equal(returning.timers.some((timer) => timer.delay === 1800), false);
  assert.deepEqual([...first.errors, ...returning.errors], []);
});

test("only the completed overlay animation dismisses it, with a timeout safety net", async (context) => {
  const fixture = await openFixture();
  context.after(fixture.close);
  const { document, window } = fixture;
  const childEvent = new window.Event("animationend", { bubbles: true });
  Object.defineProperty(childEvent, "animationName", { value: "opening-reveal" });
  document.querySelector("#opening-name").dispatchEvent(childEvent);
  assert.equal(document.querySelector("#opening-intro").hidden, false);
  const fallback = fixture.timers.find((timer) => timer.delay === 1800);
  assert.ok(fallback);
  fallback.callback();
  assert.equal(document.querySelector("#opening-intro").hidden, true);
});

test("keyboard, pointer, touch, scroll and focus immediately dismiss without cancelling input", async (context) => {
  for (const eventName of ["pointerdown", "touchstart", "click", "keydown", "wheel", "scroll", "focusin"]) {
    const fixture = await openFixture({ withoutD3: true });
    context.after(fixture.close);
    const event = new fixture.window.Event(eventName, { bubbles: true, cancelable: true });
    fixture.document.querySelector("#resume").dispatchEvent(event);
    assert.equal(fixture.document.querySelector("#opening-intro").hidden, true, eventName);
    assert.equal(event.defaultPrevented, false, eventName);
  }
});

test("edit controls work during the intro and resetting copy does not reset the first-visit flag", async (context) => {
  const fixture = await openFixture();
  context.after(fixture.close);
  fixture.document.querySelector("#edit-toggle").click();
  assert.equal(fixture.document.querySelector("#opening-intro").hidden, true);
  assert.equal(fixture.document.body.classList.contains("is-editing"), true);
  fixture.document.querySelector("#reset-button").click();
  assert.equal(fixture.window.localStorage.getItem(introKey), "1");
  assert.equal(fixture.document.querySelector("#opening-intro").hidden, true);
});

test("reduced-motion visitors skip the intro and preference changes stop it immediately", async (context) => {
  const reduced = await openFixture({ reducedMotion: true });
  const playing = await openFixture();
  context.after(() => { reduced.close(); playing.close(); });
  assert.equal(reduced.document.querySelector("#opening-intro").hidden, true);
  assert.equal(reduced.window.localStorage.getItem(introKey), "1");
  playing.reduceMotion();
  assert.equal(playing.document.querySelector("#opening-intro").hidden, true);
});

test("storage restrictions fall back to once per session or skip without blocking the CV", async (context) => {
  const session = await openFixture({ blockedStorage: ["localStorage"] });
  context.after(session.close);
  assert.equal(session.document.querySelector("#opening-intro").hidden, false);
  assert.equal(session.window.sessionStorage.getItem(introKey), "1");
  const returning = await openFixture({ blockedStorage: ["localStorage"], sessionStorage: { [introKey]: "1" } });
  const unavailable = await openFixture({ blockedStorage: ["localStorage", "sessionStorage"] });
  context.after(() => { returning.close(); unavailable.close(); });
  assert.equal(returning.document.querySelector("#opening-intro").hidden, true);
  assert.equal(unavailable.document.querySelector("#opening-intro").hidden, true);
  unavailable.document.querySelector("#pdf-button").click();
  assert.equal(unavailable.printCount, 1);
  assert.deepEqual([...session.errors, ...returning.errors, ...unavailable.errors], []);
});

test("direct section links, print media and navigation away leave no active overlay", async (context) => {
  const linked = await openFixture({ url: "https://cv.example.test/#experience-heading" });
  const printing = await openFixture({ printMedia: true });
  const leaving = await openFixture();
  context.after(() => { linked.close(); printing.close(); leaving.close(); });
  assert.equal(linked.document.querySelector("#opening-intro").hidden, true);
  assert.equal(printing.document.querySelector("#opening-intro").hidden, true);
  leaving.window.dispatchEvent(new leaving.window.Event("pagehide"));
  assert.equal(leaving.document.querySelector("#opening-intro").hidden, true);
});

test("intro uses saved identity content and works without visualization libraries", async (context) => {
  const fixture = await openFixture({
    withoutD3: true,
    localStorage: { "will-chen-resume-v7": JSON.stringify({ name: "Will Chen Test", headline: "Engineering Lead Test" }) }
  });
  context.after(fixture.close);
  assert.equal(fixture.document.querySelector("#opening-intro").hidden, false);
  assert.equal(fixture.document.querySelector("#opening-name").textContent, "Will Chen Test");
  assert.equal(fixture.document.querySelector("#opening-role").textContent, "Engineering Lead Test");
  fixture.document.querySelector("#pdf-button").click();
  assert.equal(fixture.printCount, 1);
  assert.deepEqual(fixture.errors, []);
});

test("saved working-style defaults migrate to technical leadership without replacing custom edits", async (context) => {
  const previousCopy = "Clear decisions. Observable systems. Small, reversible changes. Teams that understand why.";
  const fresh = await openFixture();
  context.after(fresh.close);
  const heading = fresh.document.querySelector('[data-edit-id="methods-heading"]').textContent;
  const copy = fresh.document.querySelector('[data-edit-id="methods-copy"]').textContent;
  assert.equal(heading, "Technical leadership");
  assert.match(copy, /technical direction across teams/);
  assert.match(copy, /reliability, cost, and delivery trade-offs/);
  assert.match(copy, /mentor engineers/);
  for (const [savedHeading, savedCopy, expectedHeading, expectedCopy] of [
    ["Ways of working", previousCopy, heading, copy],
    ["Custom heading", "Custom approach.", "Custom heading", "Custom approach."],
    ["Custom heading", previousCopy, "Custom heading", copy],
    ["Ways of working", "Custom approach.", heading, "Custom approach."]
  ]) {
    const fixture = await openFixture({
      localStorage: {
        "will-chen-resume-v7": JSON.stringify({
          "methods-heading": savedHeading,
          "methods-copy": savedCopy,
          name: "Preserved Name"
        })
      }
    });
    context.after(fixture.close);
    assert.equal(fixture.document.querySelector('[data-edit-id="methods-heading"]').textContent, expectedHeading);
    assert.equal(fixture.document.querySelector('[data-edit-id="methods-copy"]').textContent, expectedCopy);
    assert.equal(fixture.document.querySelector('[data-edit-id="name"]').textContent, "Preserved Name");
    assert.deepEqual(fixture.errors, []);
  }
});

test("HTML downloads reset transient animation state without sharing the visitor flag", async (context) => {
  const fixture = await openFixture();
  context.after(fixture.close);
  const download = await fixture.download("download-button");
  assert.equal(download.filename, "will-chen-resume.html");
  const savedHtml = await download.blob.text();
  const savedDom = new JSDOM(savedHtml);
  assert.equal(savedDom.window.document.querySelector("#opening-intro").hidden, true);
  assert.equal(savedDom.window.document.querySelector("#opening-intro").classList.contains("is-playing"), false);
  savedDom.window.close();
  const recipient = await openFixture({ html: savedHtml });
  const returning = await openFixture({ html: savedHtml, localStorage: { [introKey]: "1" } });
  context.after(() => { recipient.close(); returning.close(); });
  assert.equal(recipient.document.querySelector("#opening-intro").hidden, false);
  assert.equal(returning.document.querySelector("#opening-intro").hidden, true);
  assert.deepEqual([...recipient.errors, ...returning.errors], []);
});

test("Word output is identical before and after the intro and contains only resume content", { timeout: 15000 }, async (context) => {
  const fixture = await openFixture();
  context.after(fixture.close);
  assert.equal(fixture.document.querySelector("#opening-intro").hidden, false);
  const original = await wordContent((await fixture.download("word-button")).blob);
  assert.equal(fixture.document.querySelector("#opening-intro").hidden, true);
  fixture.document.querySelector('[data-view="quick"]').click();
  const changed = await wordContent((await fixture.download("word-button")).blob);
  assert.equal(changed.xml, original.xml);
  assert.ok(changed.paragraphs.includes("Technical leadership"));
  assert.ok(changed.paragraphs.includes(fixture.document.querySelector('[data-edit-id="methods-copy"]').textContent));
  assert.equal(changed.paragraphs.includes("Ways of working"), false);
  for (const point of fixture.document.querySelectorAll("#resume .role-points > li")) {
    const text = point.textContent.replace(/\s+/g, " ").trim();
    assert.ok(changed.paragraphs.includes(text), `Missing Word evidence: ${text}`);
  }
  assert.equal(changed.paragraphs.filter((text) => text === "Will Chen").length, 1);
  assert.deepEqual(fixture.errors, []);
});

test("Word export follows edits to both the technical leadership heading and copy", { timeout: 15000 }, async (context) => {
  const fixture = await openFixture();
  context.after(fixture.close);
  fixture.document.querySelector("#edit-toggle").click();
  fixture.document.querySelector('[data-edit-id="methods-heading"]').textContent = "Architecture and mentorship";
  fixture.document.querySelector('[data-edit-id="methods-copy"]').textContent = "Custom technical leadership approach.";
  fixture.document.querySelector("#edit-toggle").click();
  const exported = await wordContent((await fixture.download("word-button")).blob);
  assert.ok(exported.paragraphs.includes("Architecture and mentorship"));
  assert.ok(exported.paragraphs.includes("Custom technical leadership approach."));
  assert.equal(exported.paragraphs.includes("Ways of working"), false);
  assert.deepEqual(fixture.errors, []);
});

test("PDF action preserves the existing edit-state restore behavior", async (context) => {
  const fixture = await openFixture();
  context.after(fixture.close);
  fixture.window.dispatchEvent(new fixture.window.Event("beforeprint"));
  assert.equal(fixture.document.querySelector("#opening-intro").hidden, true);
  fixture.document.querySelector("#edit-toggle").click();
  fixture.document.querySelector("#pdf-button").click();
  assert.equal(fixture.printCount, 1);
  assert.equal(fixture.document.body.classList.contains("is-editing"), false);
  fixture.window.dispatchEvent(new fixture.window.Event("afterprint"));
  assert.equal(fixture.document.body.classList.contains("is-editing"), true);
});