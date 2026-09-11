# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Ushers registering visitors and coordinating initial follow-up, often during or immediately after a church service and frequently from a mobile device.
- Pastors reviewing visitor and member care history, support needs, visits, and pastoral follow-up.
- Administrators overseeing access, attendance, people records, and ministry operations.

## Product Purpose

Church Care Hub is a role-based care-management workspace for Central Islip SDA. It brings visitor registration, attendance, care notes, visits, member records, and administrative oversight into one shared application. Success means an authorized ministry worker can quickly locate a person, understand the current care context, and record the appropriate next action without losing continuity.

## Positioning

The product organizes church follow-up around a shared, permission-aware care record rather than treating visitors as anonymous attendance counts or generic CRM leads.

## Operating Context

- Used before, during, and after church services on desktop and mobile web devices.
- Visitor and member records may contain sensitive personal and pastoral information.
- The People workspace combines a searchable directory, selected-person context, visit recording, support notes, and shared history.
- Supabase provides the existing authenticated data layer; redesign work must not query, export, copy, seed, transform, or otherwise touch production visitor data.

## Capabilities and Constraints

- Preserve all current routes, role permissions, authentication, attendance, people, birthday, import, and administration functionality.
- Replace the visitor form's preferred-name field with an address field. Existing preferred-name data remains untouched in storage and is simply not exposed by the redesigned visitor interface.
- Address support may be prepared in source and schema migration files, but no migration may be applied and no visitor record may be created, edited, deleted, or submitted during design and verification.
- Redesign the application shell and People/Visitor workspace, with special attention to the visitor directory and care-record containers that currently feel visually clumsy.
- Use only synthetic, explicitly fictional people and care activity in design previews and screenshots.

## Brand Commitments

- Product name: Church Care Hub.
- Organization identity: Central Islip SDA.
- The redesigned color system remains recognizably Seventh-day Adventist through disciplined green and yellow roles. Green and yellow must remain visually separated through neutral surfaces, restrained accent use, and clear semantic assignments rather than blending across large areas.
- The tone is welcoming, dignified, discreet, and operationally clear—never flashy, playful, or sales-oriented.

## Evidence on Hand

- Current React, TypeScript, Vite, and Supabase application source.
- Existing role and workflow documentation in the repository.
- No visitor or member record content is authorized for design use; future previews must not fabricate claims or present synthetic records as real.

## Product Principles

- Protect dignity and privacy before visual novelty.
- Make the next care action obvious without reducing people to metrics.
- Preserve continuity across ushers, pastors, and administrators.
- Keep frequent service-day tasks fast on mobile devices.
- Use status, hierarchy, and wording—not saturated color—to communicate meaning.

## Accessibility & Inclusion

Preserve existing keyboard and semantic interaction behavior, maintain visible focus and readable contrast, and support practical mobile use without horizontal overflow or hidden primary actions.
