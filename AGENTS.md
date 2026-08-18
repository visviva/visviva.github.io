# Repository Guidelines

## Project Structure & Module Organization

This repository is a Hugo site. Site-wide settings live in `hugo.toml`. Add articles and pages under
`content/`; `archetypes/default.md` supplies front matter for new content. Put files copied directly
to the site in `static/`, pipeline-processed resources in `assets/`, and project-specific template
overrides in `layouts/`. The `data/` and `i18n/` directories are available for structured data and
translations.

The custom theme lives at `themes/hugo-margin-tech`. This theme is created by the user and can be
changed. When there are request or changes to the theme, `docs\theme-requirements.md` must be kept
up to date.

Hugo writes the generated site to `public/`; it is ignored and must not be committed.

## Build, Test, and Development Commands

- `git submodule update --init --recursive` fetches the theme after cloning.
- `hugo new content posts/my-post.md` creates a draft using the repository archetype.
- `hugo server -D` starts a live-reloading local server and includes drafts.
- `hugo --minify` creates a production-style build in `public/`.

Run commands from the repository root. The theme has separate Bun scripts for theme development, but
they are not required for normal site work.

## Coding Style & Naming Conventions

Use TOML for configuration and front matter, Markdown for content, and two-space indentation in
HTML/CSS overrides. Name content files with lowercase kebab-case, such as
`content/posts/orbital-mechanics.md`. Keep front matter keys lowercase and set `draft = true` until
an article is ready. Favor small templates and Hugo partials over duplicated markup. Preserve
existing formatting in the theme submodule.

## Configuration & Security

Do not commit secrets or environment-specific credentials. Confirm `baseURL`, locale, and title in
`hugo.toml` before deployment; use deployment settings or ignored local configuration for sensitive
values.
