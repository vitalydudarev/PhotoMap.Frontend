# PhotoMap: feature ideas

As of 2026-11-12 · Shared doc: [PhotoMap: feature ideas](https://claude.ai/artifact/Gq83UQKp4cQqpVfw7GLasB)

## Where the app stands

PhotoMap's map, gallery and source sync are already in place, so most new features can build on existing data rather than start from scratch.

- **Gallery:** filters by source, year, category, GPS and tag; bulk select and tagging; a month timeline; duplicate detection; a viewer with EXIF.
- **Map:** Leaflet or Google Maps with clustering, a day-split panel for crowded spots, and a flag on imprecise locations.
- **Videos:** a separate page with folder filtering and playback.
- **Sources:** Yandex.Disk and Dropbox pages for processing, downloads and retrying failed files, with live progress over SignalR.

## Map and location

The map is what sets PhotoMap apart, so these ideas get the most from it.

- **Trips and journeys:** group photos by day and time into trips and draw each route as a line on the map, with day-by-day playback.
- **Heatmap layer:** switch between markers and a density heatmap of where photos were taken.
- **"Where I've been" stats:** countries, cities and regions visited, shaded on the map, with a first-visited date. Needs reverse geocoding.
- **Map and gallery sync:** filter the gallery to the map's visible area, or draw a rectangle or lasso on the map to select photos.
- **Fix or add locations by hand:** drag a photo onto the map, or copy the location from a photo taken nearby in time.
- **Guess locations for photos without GPS:** take the location of the closest photo in time (for example within 30 minutes) and mark it as a guess.
- **Time slider:** scrub through years or months and watch the markers appear.
- **Nearby photos:** in the viewer, show other photos taken within 200 m.

## Gallery and browsing

These make the existing photos quicker to find and enjoy.

- **Search by place name** ("Paris"), file name or path.
- **On this day:** photos from today's date in earlier years.
- **Date range filter:** finer than year; the timeline already has the month data.
- **Albums:** curated, ordered sets with a cover photo. Tags are flat and unordered.
- **Favourites or star ratings**, with a filter for them.
- **Viewer keyboard shortcuts:** arrow keys to move, F to favourite, T to tag, Delete to delete.
- **Slideshow**, optionally with a mini-map of where each photo was taken.
- **Photos and videos in one view:** videos live on a page of their own today.
- **Saved filters (smart albums):** for example drone footage with GPS from 2024.
- **More sort orders:** by place, file size or camera.

## Clean-up and library health

These help keep a large library tidy.

- **Near-duplicate detection:** only byte-identical copies are flagged today. A perceptual hash would also catch burst shots and edited copies, with a "keep best, delete the rest" action.
- **Empty the trash:** purge the Deleted category automatically after a set number of days, or restore in bulk.
- **Low-value files report:** screenshots, blurry or very dark photos, very small images.
- **Library dashboard:** photos per year and month, per source and per camera, the share with GPS, storage used and failed-file counts. A good candidate for the home page.

## EXIF and metadata

The viewer already shows EXIF, so it can also be used for filtering and correction.

- **Filter by camera details:** phone or camera model, lens, ISO or focal length.
- **Correct dates in bulk:** shift the time or time zone of a batch of photos, which fixes cameras whose clock was off.
- **Export with metadata:** download the selected photos as a ZIP, with their tags written to XMP.

## Smart and AI features

All of these need backend work as well as frontend work.

- **Auto-tagging:** detect objects and scenes (beach, mountain, food) with a vision model.
- **Face grouping:** people as a filter.
- **Natural-language search:** for example "sunset photos at the sea in 2023".
- **Trip summaries:** a generated title, dates, places and highlight photos for each trip.

## Sources and sync

These widen what the app can pull in and make syncing hands-off.

- **More sources:** Google Photos, OneDrive, an iCloud export, or a local folder or NAS over SMB or WebDAV.
- **Scheduled sync:** automatic runs instead of manual ones, with a "last synced" status on each source.
- **One overview page for all sources:** status, progress and errors together. SignalR progress already exists.
- **Notification centre:** a history of hub events and failures, rather than only short-lived toasts.

## Sharing

These let photos and trips be shown to other people.

- **Share an album or trip** through a public, read-only link, optionally with its map.
- **Export a trip** as a GPX or KML file, or as a printable or static HTML travel story.

## UX and technical

These improve everyday use and reach.

- **Virtual or infinite scrolling** as an alternative to pages of 1000 items.
- **Filters in the URL:** keep them in query parameters so a filtered gallery can be bookmarked or shared.
- **PWA with offline thumbnails**, installable on a phone.
- **Mobile layout:** the source panels are fixed at 1000px wide today.
- **Localisation:** `@angular/localize` is already a dependency, so a Russian and English toggle is cheap.
- **Accessibility:** keyboard navigation in the grid and the viewer, and alt text from tags or places.

## Top picks

These five give the most value for the effort, in this order.

1. **Map and gallery sync, with drawing a selection on the map:** connects the two main views at low cost.
2. **Trips with route lines and a time slider:** the most distinctive feature for a photo map.
3. **Guessing and fixing locations for photos without GPS:** directly increases how many photos appear on the map.
4. **Library dashboard as the home page:** most of its data already exists.
5. **Near-duplicate detection:** extends an existing feature, and has the most clean-up value.
