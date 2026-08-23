# Hugo Technical Blog Theme — Requirements Specification

## 1. Purpose

The theme shall provide a clean, content-focused Hugo website for a personal technical blog.

The design shall prioritize:

- readability of long technical articles;
- navigation through a growing archive of posts;
- support for code-heavy and structured technical writing;
- contextual annotations alongside article content;
- a restrained visual style with minimal distraction;
- responsive behavior across desktop, tablet, and mobile devices.

The theme shall consist primarily of:

1. an index/home page;
2. post archive and taxonomy navigation;
3. an Imprint and Privacy page;
4. individual article pages with a three-column layout.

---

## 2. Technical Platform

The theme shall be implemented as a standard Hugo theme.

It shall:

- use Hugo templates and layouts rather than requiring a separate application framework;
- use Hugo's built-in content model wherever practical;
- support Hugo taxonomies for tags;
- support posts written in Markdown;
- support Hugo's generated table of contents;
- avoid JavaScript dependencies unless they provide a clear usability benefit;
- remain usable when client-side JavaScript is unavailable, except for non-essential enhancements.

The theme should be installable under:

```text
themes/<theme-name>/
```

and enabled through the site's Hugo configuration.

---

## 3. Site Information Architecture

The theme shall support the following primary pages:

```text
/
├── Home / Index
├── Posts
│   └── Individual Post
├── Tags
│   └── Tag Archive
└── Imprint and Privacy
```

The primary site navigation shall provide access to at least:

- Home;
- Tags or another equivalent way to browse posts by topic.

The Imprint and Privacy page shall remain accessible from the About section on the home page rather
than from the primary site navigation.

Additional navigation items may be configurable by the site owner.

---

## 4. Home Page

### 4.1 Purpose

The home page shall function as both a personal introduction and the main entry point into the post
archive.

The biography and archive shall be vertically stacked, with the biography appearing first and the
archive following it. They shall not appear as side-by-side columns on wide screens.

The biography and archive shall share a constrained home-page column. Their headings shall be
left-aligned. The narrower biography text block shall be horizontally centered within that column,
use a maximum width of approximately 640 pixels, and use justified paragraph text. The introduction
shall use readable body text and the author name shall not dominate the page's visual hierarchy.

The biography shall display `About` as its primary heading using the same typography and size as
the `Writing` heading. A horizontal divider shall separate the About heading from the centered text
block. The theme shall not display the author name separately above the biography content; it may
instead be included naturally within the home-page Markdown.

The About header shall display a quiet link to the Imprint and Privacy page on its right, matching
the placement and styling of the tag-browsing link in the Writing header.

### 4.2 Biography

The home page shall contain a short biography or introduction.

The biography should support:

- author name;
- short descriptive text;
- optional profile image;
- optional links such as GitHub, email, LinkedIn, Mastodon, RSS, or a personal project page.

The biography content shall be configurable rather than hard-coded in the theme.

The theme shall render the Markdown content of the home page's `content/_index.md` file below the
author name. This content may be used for a longer description of the author, the blog, or both. If
the home page has no Markdown content, the theme shall fall back to the short biography configured
through site parameters instead of displaying both descriptions.

### 4.3 Post Listing

The home page shall display the site's posts.

Each post entry shall display, at minimum:

- title;
- publication date.

It should additionally support:

- tags;
- short description or summary;
- estimated reading time.

The reading-time estimate shall be calculated automatically from the post content using Hugo's
built-in reading-time metadata. Authors shall not need to maintain it in front matter. The estimate
shall be visible on the article page and in post listings.

Post entries shall link to the full article.

### 4.4 Ordering by Year

Posts shall be visually grouped by publication year.

Example:

```text
2026

Building a Compiler in Go                Aug 14
Notes on PostgreSQL Query Planning       Jun 02

2025

Understanding Linux Namespaces           Dec 11
A Small Guide to eBPF                     Sep 04
```

Years shall appear in descending order by default.

Posts within each year shall appear in descending publication-date order by default.

The implementation should use Hugo's content metadata rather than maintaining a separate manually
authored archive.

---

## 5. Tag Filtering

### 5.1 Tag Metadata

Posts shall support one or more tags through Hugo front matter.

Example:

```yaml
tags:
  - Go
  - Compilers
  - Linux
```

### 5.2 Tag Navigation

Users shall be able to browse posts belonging to a particular tag.

The theme shall support Hugo-generated tag taxonomy pages.

A tag archive shall show:

- tag name;
- matching posts;
- publication dates.

The post-list presentation should remain visually consistent with the main index.

### 5.3 Tag Presentation

Tags associated with a post should be visible from:

- the article page;
- optionally the home/archive listing.

Each tag shall link to the corresponding tag archive.

---

## 6. Imprint and Privacy Page

The theme shall provide an Imprint and Privacy page suitable for legal, contact, privacy, and
third-party license information.

The page shall use normal Hugo content so that the site owner can author it in Markdown.

Typical content may include:

- site owner or publisher information;
- contact information;
- legally required disclosures;
- hosting and third-party resource information;
- local browser storage and email-contact processing;
- data-subject rights;
- third-party license notices.

The Imprint and Privacy page does not require the three-column article layout unless explicitly
enabled.

---

## 7. Article Page

### 7.1 General Layout

On sufficiently wide screens, an individual article shall use a three-column layout:

```text
┌─────────────────┬───────────────────────────────┬─────────────────┐
│                 │                               │                 │
│  Table of       │        Article Content        │  Notes and      │
│  Contents       │                               │  Remarks        │
│                 │                               │                 │
│                 │                               │                 │
└─────────────────┴───────────────────────────────┴─────────────────┘
```

The columns shall have distinct purposes:

- **left:** table of contents;
- **center:** primary article content;
- **right:** contextual notes and remarks.

The center column shall remain the visual focus of the page.

### 7.2 Reading Progress

Individual article pages shall display a slim reading-progress indicator directly below the sticky
site header. It shall advance as the reader scrolls through the article and reach completion at the
end of the article content.

The indicator shall expose its current percentage to assistive technology. Because it is a
progressive enhancement, the article shall remain fully readable when JavaScript is unavailable.

---

## 8. Left Column — Table of Contents

### 8.1 Generation

The table of contents shall be generated from article headings using Hugo's built-in
table-of-contents functionality.

Authors shall not need to manually maintain a separate TOC.

### 8.2 Positioning

On desktop layouts, the TOC shall remain visible while the reader scrolls through the article.

A sticky or equivalent floating implementation shall be used.

The TOC shall stop before overlapping the site footer or other page boundaries.

### 8.3 Contents

The TOC shall contain links to relevant article headings.

The heading depth should be configurable through Hugo's Markdown configuration where practical.

### 8.4 Current Section

The theme should visually indicate which article section is currently being read.

This enhancement may use minimal JavaScript.

The article shall remain fully navigable without this enhancement.

### 8.5 Empty TOC

For articles without enough headings to generate a useful table of contents, the left rail may be
hidden or left empty without negatively affecting the article layout.

---

## 9. Center Column — Article Content

### 9.1 Typography

The primary article column shall be optimized for long-form technical reading.

It shall provide appropriate styling for:

- headings;
- paragraphs;
- links;
- ordered lists;
- unordered lists;
- block quotes;
- inline code;
- code blocks;
- tables;
- images;
- figures;
- horizontal rules;
- footnotes.

The article text width shall be constrained to a comfortable reading measure.

Paragraphs in the primary article content shall use justified text with automatic hyphenation.

Headings shall use restrained letter spacing that keeps the type compact without appearing crowded.

### 9.2 Code

Code shall be treated as a first-class content type.

The theme shall support:

- fenced Markdown code blocks;
- syntax highlighting through Hugo;
- horizontal overflow for long lines;
- inline code;
- copy-friendly text selection.

Code blocks shall not force the entire page to overflow horizontally.

### 9.3 Headings

Article headings shall:

- have stable anchor links;
- be distinguishable from normal text;
- work with the generated table of contents.

Optional heading-link indicators may be displayed on hover.

### 9.4 Images and Figures

Images shall fit within the available article area.

The theme should support captions when authored through suitable Markdown or shortcode constructs.

Large media shall remain responsive.

Draw.io diagrams shall be exported to a browser-compatible image format such as SVG or PNG and
included through normal Markdown image syntax. The theme shall not require the online draw.io
viewer or a draw.io-specific client-side runtime.

### 9.5 Mathematics and Mermaid

Articles shall support TeX mathematics rendered by MathJax. Math rendering may be enabled for the
whole site through `params.math` or for an individual page through its `math` front matter value.
Authors shall be able to use `$...$` for inline math and `$$...$$` for display math.

Articles shall support Mermaid diagrams authored as fenced `mermaid` code blocks in Markdown. The
Mermaid runtime shall only be loaded on pages that contain such a block. Before or without
JavaScript rendering, the diagram source shall remain readable.

---

## 10. Right Column — Notes and Remarks

### 10.1 Purpose

The right column shall support annotations that relate directly to portions of the main text.

Typical uses include:

- additional explanation;
- references;
- caveats;
- implementation remarks;
- alternative approaches;
- side comments;
- citations;
- brief examples.

These notes shall visually remain secondary to the main article.

### 10.2 Authoring Interface

Authors shall be able to create a margin note from Markdown content without writing layout-specific
HTML.

A Hugo shortcode shall be provided.

Example:

```markdown
The scheduler uses cooperative cancellation.

{{< note >}} Cancellation is propagated through the request context rather than by terminating the
worker directly. {{< /note >}}
```

### 10.3 Placement

On wide desktop screens, the note shall appear in the right rail approximately adjacent to the
content that references it.

Multiple notes in the same region shall remain readable and shall not overlap.

Margin notes shall scroll naturally with the article rather than stick to the viewport. Only the
article table of contents may remain sticky.

Margin notes shall not display a numbered marker in the prose. On desktop they shall be positioned
outside the article's normal flow so their width does not change line wrapping or reserve vertical
space in the central content column.

### 10.4 Note Content

Margin notes shall support common Markdown content where feasible, including:

- links;
- inline code;
- emphasis;
- short paragraphs.

They are not required to support arbitrarily complex nested layouts.

### 10.5 Mobile Behavior

The right margin shall not consume a permanent column on narrow screens.

Margin notes shall instead appear in an inline or expandable form associated with their reference
point.

The relationship between the article text and the corresponding note must remain clear.

No note content shall become inaccessible merely because the viewport is narrow.

---

## 11. Responsive Layout

The theme shall adapt to at least three broad layout conditions.

### Desktop

On sufficiently wide screens:

```text
TOC | Article | Notes
```

All three columns may be displayed simultaneously.

### Tablet / Medium Width

On medium-width screens:

- the article shall remain the primary element;
- the TOC may become narrower, collapsible, or move above the article;
- margin notes may become inline.

### Mobile

On small screens:

```text
Article
+ inline/collapsible notes
```

The page shall not depend on horizontal scrolling for navigation.

The main site header and navigation shall remain usable on mobile devices.

---

## 12. Header and Navigation

The site shall include a lightweight global header.

It shall support:

- site title or author name;
- link to the home page;
- access to tags;
- optional configurable navigation links.

Configured social links shall be displayed in the top header. Supported identity parameters shall
include GitHub and email, with optional LinkedIn, Mastodon, and Bluesky links. A GitHub handle may
be supplied without a complete URL.

The header shall remain visually subordinate to the article content.

A large marketing-style navigation system is explicitly not required.

---

## 13. Footer

A simple footer shall be provided.

The copyright name shall use `params.name` from the active site's `hugo.toml` (with legacy
`params.author` accepted only as a fallback).

The footer shall link to the Imprint and Privacy page.

It may contain:

- copyright information;
- author name;
- RSS link;
- source repository link;
- optional configurable text.

The footer shall not interfere with the sticky table of contents or article rails.

---

## 14. Front Matter

A normal blog post should support front matter similar to:

```yaml
---
title: "Understanding Linux Namespaces"
date: 2026-08-14
description: "An introduction to Linux namespaces and how containers use them."
tags:
  - Linux
  - Containers
draft: false
---
```

The theme shall rely primarily on standard Hugo metadata.

Optional theme-specific parameters should be kept to a minimum.

---

## 15. Visual Design

The visual design shall be restrained and appropriate for a technical publication.

The light palette shall use cool neutral surfaces with restrained blue accents. Color shall add
hierarchy without turning the page into a product-style interface.

It should favor:

- neutral backgrounds;
- high text contrast;
- generous whitespace;
- understated borders;
- minimal decorative elements;
- strong typographic hierarchy.

The design should avoid:

- oversized hero sections;
- excessive cards;
- heavy gradients;
- animated backgrounds;
- large decorative illustrations;
- excessive rounded UI elements;
- visual effects that compete with technical content.

The aesthetic should resemble a technical notebook, research publication, or carefully typeset
engineering journal more than a commercial landing page.

---

## 16. Typography

The theme shall differentiate prose and code clearly.

It shall use:

- Source Serif 4 for headings;
- Source Sans 3 for long-form prose, navigation, and interface text;
- Fira Code for source code, inline code, dates, and monospaced metadata.

The fonts shall be self-hosted as variable WOFF2 files, use `font-display: swap`, and retain suitable
system-font fallbacks.

Typography shall maintain readable line height and paragraph spacing.

---

## 17. Dark Mode

The theme shall support light and dark color modes. It shall:

- respect `prefers-color-scheme`;
- preserve sufficient contrast;
- apply consistently to prose, navigation, code, tables, diagrams, notes, and TOC elements;
- provide a keyboard-accessible manual switch in the header;
- persist the visitor's explicit choice between page loads.

The dark palette shall be inspired by One Dark Pro, using a charcoal `#282c34` page background
rather than a near-black surface. Its supporting colors should use the recognizable muted blue,
green, amber, red, cyan, and violet family without overwhelming prose.

Hugo syntax highlighting shall emit Chroma classes rather than inline colors. The theme shall own
coordinated light and dark syntax palettes; Monokai styling shall not be used.

---

## 18. Accessibility

The generated site shall use semantic HTML where practical.

The theme shall:

- preserve logical heading structure;
- provide keyboard-accessible navigation;
- provide visible keyboard focus styles;
- avoid using color as the only indicator of state;
- provide adequate text/background contrast;
- allow normal browser text resizing;
- avoid unnecessary motion.

Interactive note and navigation elements shall expose an accessible state where applicable.

---

## 19. Performance

The theme shall remain lightweight.

The default implementation should avoid:

- large JavaScript frameworks;
- mandatory web-font downloads;
- unnecessary third-party scripts;
- large CSS dependencies.

JavaScript should be limited to progressive enhancements such as:

- active TOC section highlighting;
- expandable mobile margin notes.

The site shall remain readable without JavaScript.

---

## 20. SEO and Document Metadata

The theme should generate conventional page metadata, including:

- page title;
- description;
- canonical URL where available;
- Open Graph metadata;
- appropriate document language.

Article markup should make the primary content semantically identifiable.

---

## 21. RSS

The site shall remain compatible with Hugo's RSS generation.

An RSS or Atom discovery link should be available from the site.

The visual theme must not require custom content duplication for feed generation.

---

## 22. Hugo Directory Structure

A recommended theme structure is:

```text
theme/
├── archetypes/
├── assets/
│   ├── css/
│   │   └── main.css
│   └── js/
│       └── main.js
├── layouts/
│   ├── _default/
│   │   ├── baseof.html
│   │   ├── list.html
│   │   └── single.html
│   ├── partials/
│   │   ├── header.html
│   │   ├── footer.html
│   │   ├── post-list.html
│   │   └── toc.html
│   ├── shortcodes/
│   │   └── note.html
│   ├── index.html
│   └── taxonomy/
├── static/
├── exampleSite/
├── hugo.toml
├── README.md
└── theme.toml
```

Exact organization may vary as long as the resulting theme remains idiomatic and maintainable.

---

## 23. Example Site

The theme shall include an example site demonstrating its main features.

The example content shall include:

- a home-page biography;
- an Imprint and Privacy page;
- posts spanning multiple years;
- multiple tags;
- an article with several headings;
- an article with code blocks;
- an article containing several margin notes.
- TeX mathematics;
- a Mermaid diagram;
- an exported draw.io diagram included as a normal Markdown image;
- common prose elements including lists, a block quote, a table, code, and a footnote.

The example shall make it possible for a developer to understand the theme without first inspecting
its template implementation.

---

## 24. Configuration

The site owner shall be able to configure basic identity information through Hugo configuration and
content rather than editing templates.

Configuration should support at least:

```toml
title = "Example Technical Blog"

[params]
name = "Jane Developer"
description = "Notes on systems, programming, and software engineering."
math = true
```

Optional social links may also be configurable. Configured social links shall appear in the global
header.

Navigation should use Hugo menus or a similarly conventional Hugo mechanism.

---

## 25. Browser Compatibility

The theme shall support current versions of major evergreen browsers.

The layout should not require experimental CSS features when a stable alternative is practical.

Progressive CSS enhancements are acceptable as long as the content remains readable without them.

---

## 26. Maintainability

Theme templates shall favor understandable Hugo constructs over unnecessary abstraction.

Shared UI shall be implemented through partials where appropriate.

CSS should be organized around identifiable concerns such as:

- global layout;
- typography;
- archive lists;
- article layout;
- TOC;
- margin notes;
- syntax highlighting;
- responsive behavior.

Theme-specific JavaScript should remain small and dependency-free unless a strong reason for a
dependency emerges.

---

## 27. Acceptance Criteria

The initial version of the theme shall be considered complete when all of the following are true:

- [ ] A Hugo site can enable the theme and render successfully.
- [ ] The home page displays Markdown content from `content/_index.md`, with the configured short
  biography as a fallback.
- [ ] The biography appears above the archive rather than beside it.
- [ ] The About and Writing headings are left-aligned.
- [ ] The biography text block is horizontally centered with justified paragraph text.
- [ ] The About and Writing headings use the same typography and size.
- [ ] The home page displays published posts.
- [ ] Posts are grouped by publication year.
- [ ] Years and posts are shown newest first.
- [ ] Posts support Hugo tags.
- [ ] Clicking a tag displays the corresponding post archive.
- [ ] An Imprint and Privacy page can be written in Markdown.
- [ ] Article pages display a generated TOC on desktop.
- [ ] The TOC remains visible while scrolling long articles.
- [ ] Article pages show a reading-progress indicator below the sticky header.
- [ ] Reading time is calculated automatically and displayed on articles and post listings.
- [ ] Article content occupies the central reading column.
- [ ] Authors can add right-margin notes through a shortcode.
- [ ] Margin notes appear beside article content on wide screens.
- [ ] Margin notes scroll with their references and do not stick to the viewport.
- [ ] Margin notes remain accessible on mobile.
- [ ] Code blocks render without breaking the page layout.
- [ ] Math renders when enabled globally or in page front matter.
- [ ] Fenced Mermaid blocks render as diagrams.
- [ ] Exported draw.io SVG or PNG files work as standard Markdown images without an online viewer.
- [ ] Configured social links appear in the top header.
- [ ] The footer copyright uses `params.name` from the site configuration.
- [ ] The footer links to the Imprint and Privacy page.
- [ ] A persisted, keyboard-accessible light/dark mode switch is available in the header.
- [ ] Article pages do not require page-level horizontal scrolling on mobile.
- [ ] Long articles remain readable across desktop and mobile layouts.
- [ ] Site navigation works with a keyboard.
- [ ] The theme remains functional without JavaScript.
- [ ] The example site demonstrates the major theme capabilities.
- [ ] Basic installation and authoring instructions are documented in the README.

---

## 28. Non-Goals for the Initial Version

The following capabilities are not required for the first version:

- built-in comments;
- user accounts;
- a CMS;
- full-text client-side search;
- newsletter integration;
- analytics integration;
- reactions or likes;
- complex multilingual navigation;
- dynamic server-side filtering;
- an administrative interface;
- SPA-style page navigation.

These capabilities may be added later without changing the fundamental theme structure.

---

## 29. Future Enhancements

Possible later additions include:

- full-text search;
- series or collections of related posts;
- previous/next article navigation;
- copy buttons for code blocks;
- richer footnote and citation support;
- configurable margin-note numbering;
- print-specific styling;
- automatic link previews;
- archive filtering without page navigation.

These enhancements should not be allowed to complicate the core reading experience of the initial
theme.
