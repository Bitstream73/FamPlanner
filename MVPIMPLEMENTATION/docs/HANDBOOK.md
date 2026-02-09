# Household Handbook — Spec

## Overview

A lightweight knowledge base for household info: pinned notes (Wi-Fi password, trash days, emergency contacts) and how-to guides (step-by-step instructions with images). Inspired by Quinyx's shared documentation feature adapted for household reference material.

## Handbook Service

```js
// src/services/handbook-service.js
class HandbookService {
  constructor(db) {}

  // Notes
  createNote(householdId, { title, content, isPinned, createdBy }) → entry
  // How-to entries
  createHowTo(householdId, { title, content, steps, imageUrls, createdBy }) → entry

  // Common CRUD
  getEntry(entryId) → entry
  updateEntry(entryId, updates, requesterId) → entry
  deleteEntry(entryId, requesterId) → void

  // Listing
  listEntries(householdId, { type, limit, offset }) → { entries, total }
  getPinnedEntries(householdId) → [entries]
  searchEntries(householdId, query) → [entries]
}
```

## Entry Data Shapes

### Note
```js
{
  id: 'hex-string',
  household_id: 'hex-string',
  title: 'Wi-Fi Password',
  entry_type: 'note',
  content: 'Network: FamilyNet\nPassword: CorrectHorseBattery',
  steps: null,
  image_urls: null,
  is_pinned: 1,
  created_by: 'hex-string',
}
```

### How-To
```js
{
  id: 'hex-string',
  household_id: 'hex-string',
  title: 'How to Start the Dishwasher',
  entry_type: 'howto',
  content: 'Our dishwasher needs a specific loading pattern.',
  steps: '["Load bottom rack with plates facing center","Put cups on top rack upside down","Add detergent pod to dispenser","Close and press Start twice"]',
  image_urls: '["https://example.com/dishwasher-1.jpg"]',
  is_pinned: 0,
  created_by: 'hex-string',
}
```

- `steps`: JSON array of strings (step-by-step instructions). Null for notes.
- `image_urls`: JSON array of URL strings. Null if no images.

## Search

Simple LIKE-based search across title and content:

```sql
SELECT * FROM handbook_entries
WHERE household_id = ?
  AND (title LIKE '%' || ? || '%' OR content LIKE '%' || ? || '%')
ORDER BY is_pinned DESC, updated_at DESC;
```

## Security Rules

- Only household members can view handbook entries
- parent/guardian/caregiver can create, edit, delete entries
- teen can create entries but only edit/delete their own
- kid can view entries only
- Pinning: only parent/guardian

## Test Expectations

- Create note → stored with entry_type='note', steps null
- Create how-to → stored with entry_type='howto', steps as JSON array
- Update entry → fields updated, updated_at changed
- Delete entry → removed
- List by type → correct filtering
- Pinned entries → returned first, is_pinned=1 only
- Search → matches in title and content
- Search with no results → empty array
- Permission checks enforced
