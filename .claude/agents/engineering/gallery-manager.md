# Agent: Gallery Manager
**Role:** Owner portal Gallery Builder tab. Covers gallery creation, photo upload, metadata editing, public/private toggle, lightbox, cover photo selection, and the relationship between public gallery page (gallery.html Rule of 10) and the portal.

---

## Gallery System — Four Layers

| Layer | Access | File | Status |
|---|---|---|---|
| Public gallery page | Anyone | `docs/gallery.html` | Rule of 10, 10th photo gated |
| Member gallery | Members (logged in) | `docs/members/index.html` | All non-private galleries + downloads |
| Staff gallery | Staff portal | `docs/staff/index.html` | Instagram 1080×1080 + original downloads |
| Owner gallery builder | Owner portal | `docs/owner/index.html` | Full CRUD + metadata + private toggle |

---

## Database Schema

```sql
galleries:
  id UUID, title TEXT, gallery_date DATE,
  is_private BOOLEAN DEFAULT false,
  cover_storage_path TEXT,
  event_id UUID nullable,  -- optional link to events table
  created_at TIMESTAMPTZ

gallery_photos:
  id UUID, gallery_id UUID FK → galleries(id),
  storage_path TEXT,        -- path in gallery-photos Supabase Storage bucket
  display_order INT,
  original_filename TEXT,   -- stored at upload time (f.name). Used for downloads.
  caption TEXT,
  photographer TEXT,
  date_taken DATE,
  venue_name TEXT,
  location TEXT,
  created_at TIMESTAMPTZ
```

**Storage:** `gallery-photos` bucket — private, signed URLs only. URLs are never generated on page load — deferred to IntersectionObserver.

---

## Gallery Builder UI (Owner Portal)

### Gallery List View
- Card grid — one card per gallery
- Cover image lazy-loads via IntersectionObserver (rootMargin: 150px)
- Each card shows: title, date, photo count, public/private badge, Edit + Manage + Delete buttons

### Create Gallery Modal Fields
```
Title *
Date *
Link to Event (optional) — dropdown of recent events
Private Gallery toggle — private = staff only, not members or public
Photos — device upload (JPEG/PNG/WebP/HEIC, max 10MB each)
Photo Metadata (applied to all uploaded photos at once):
  - Venue Name (default: "RIDDIM Supper Club")
  - Location (e.g. "Atlanta, GA")
  - Photographer Credit (e.g. "@riddimshots")
  - Date Taken
  - Caption / Description
```

### Gallery Manager View (after clicking Manage)
- Photo grid — thumbnails lazy via IntersectionObserver (rootMargin: 200px)
- + Add Photos button (device upload)
- Hover each photo → set as cover | edit info | delete
- Cover badge shown on designated cover photo
- Lightbox: prev/next arrows + counter + Edit Info button

### Photo Metadata Modal (per-photo edit)
```
Caption
Photographer
Date Taken
Venue Name
Location
```
Saves to `gallery_photos` row via UPDATE.

---

## Signed URL Pattern

```javascript
// NEVER generate signed URLs on page load
// ALWAYS defer to IntersectionObserver:

const obs = new IntersectionObserver(async (entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const idx = entry.target.dataset.idx;
    const photo = galleryCurrentPhotos[idx];
    if (!photo.signedUrl) {
      const { data } = await supabaseClient.storage
        .from('gallery-photos')
        .createSignedUrl(photo.storage_path, 3600);
      photo.signedUrl = data?.signedUrl;
    }
    entry.target.src = photo.signedUrl;
    obs.unobserve(entry.target);
  }
}, { rootMargin: '200px' });
```

---

## Public Gallery — Rule of 10

```javascript
const GALLERY_LIMIT = 10;  // last 10 galleries (FIFO by gallery_date DESC)
const PHOTO_LIMIT   = 10;  // first 10 photos per gallery
const GATE_INDEX    = 9;   // 10th photo (index 9) is always the gate tile
```

| Scenario | Behaviour |
|---|---|
| Gallery < 10 photos | All shown, no gate |
| Gallery = 10 photos | Photos 1–9 viewable, 10th gated |
| Gallery > 10 photos | Photos 1–9 viewable, 10th gated, "Showing 10 of X" label in gold |
| Click gate tile | Opens lightbox at index 9 — gate overlay |
| Click "Join Now — Free" | → `join.html#register` |

**Image security on public gallery:** `contextmenu` + `dragstart` blocked. CSS `pointer-events:none` + `-webkit-user-drag:none` on all `<img>`.

---

## Download Behaviour (Portal)

| Button | Portal | Method | Filename |
|---|---|---|---|
| Instagram (1080×1080) | Staff + Member | Canvas crop → blob → download | `riddim_instagram_<timestamp>.jpg` |
| Original | Staff + Member | Blob fetch → `URL.createObjectURL()` | `original_filename` from DB |
| Public | None | No download button — join to download | — |

**⛔ Always use blob fetch for downloads — never `<a href="signedUrl">`.** The anchor pattern opens in browser tab instead of downloading.

---

## Key Functions (owner/index.html)
| Function | Purpose |
|---|---|
| `openCreateGalleryModal()` | New gallery form |
| `saveGallery()` | INSERT to galleries + upload photos |
| `showGalleryList()` | Return to gallery card grid |
| `loadGalleryPhotos(galleryId)` | Load photo grid in manager view |
| `galleryEnsureSignedUrl(i)` | On-demand signed URL — skips if cached |
| `openLightbox(i)` | Opens lightbox, pre-fetches i±1 |
| `lightboxNav(dir)` | Navigate lightbox, ensures signed URL |
| `openPhotoMetaModal()` | Per-photo metadata editor |
| `savePhotoMeta()` | UPDATE gallery_photos row |
| `handleFileSelect(event)` | File picker → upload preview |
| `handleManagerFileSelect(event)` | Add photos to existing gallery |
