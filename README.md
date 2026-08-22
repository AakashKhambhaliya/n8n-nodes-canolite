# n8n-nodes-canolite

**n8n community node for [Canolite](https://github.com/AakashKhambhaliya/canolite)** — the self-hosted template-to-image and video generation platform.

Design templates visually in the Canolite editor, then generate images and MP4 videos from them in your n8n workflows.

---

## Installation

### In n8n (Community Nodes)

1. Go to **Settings → Community Nodes**
2. Click **Install a community node**
3. Enter `n8n-nodes-canolite`
4. Click **Install**

### Manual Installation

```bash
cd ~/.n8n/custom
npm install n8n-nodes-canolite
```

Restart n8n after installation.

---

## Credentials

You need a Canolite API key. Create one in your Canolite dashboard under **API Keys**.

| Field     | Description                                           | Example                      |
|-----------|-------------------------------------------------------|------------------------------|
| Base URL  | The URL of your Canolite instance                     | `http://localhost:3000`      |
| API Key   | Your API key (starts with `sk_live_`)                 | `sk_live_abc123...`          |

---

## Supported Operations

### 🖼️ Image Resource

| Operation               | Description                                                         |
|------------------------|---------------------------------------------------------------------|
| **Generate**            | Generate a single image asynchronously (returns queued job UID)     |
| **Generate (Synchronous)** | Generate a single image and wait for the result (returns image URL) |
| **Batch Generate**      | Generate multiple images from a template in one request (up to 500) |
| **Get Status**          | Check the status of a previously submitted render job               |

### 🎬 Video Resource

Requires **Canolite 1.8+** and a template containing a video layer.

| Operation          | Description                                                        |
|--------------------|--------------------------------------------------------------------|
| **Generate**       | Render a single MP4 (returns a queued job UID)                      |
| **Batch Generate** | Render up to 20 videos from one template in a single request        |
| **Get Status**     | Check a video render's status and progress                          |

There is no synchronous video operation. Encoding takes far too long to hold a
request open, so every video render is queued and answered with a job UID —
enable **Wait for Completion** to have the node poll for you.

### 📄 Template Resource

| Operation    | Description                         |
|-------------|-------------------------------------|
| **Get**      | Retrieve a specific template        |
| **Get Many** | Retrieve all templates              |

Both return `has_video`, so you can branch a workflow on whether a template can
produce an MP4.

---

## Usage Examples

### Generate an Image (Synchronous)

1. Add the **Canolite** node
2. Select **Image** → **Generate (Synchronous)**
3. Set **Template ID** to your template (e.g. `tmpl_abc123`)
4. Add **Modifications** — for each text/image object you want to change:
   - **Name**: the object name from your template
   - **Text**: replacement text (for text objects)
   - **Image URL**: replacement image URL (for image objects)
5. Optionally set **Format** (PNG/JPEG/WebP), **Quality** (1-100), **Scale** (1-3)
6. Execute — the node waits and returns the `image_url` directly

### Generate an Image (Async)

1. Select **Image** → **Generate**
2. Configure the same fields as above
3. Under **Options**, enable **Wait for Completion**
4. Set **Poll Interval** and **Max Poll Attempts** as needed
5. The node will automatically poll until the render completes or times out

### Batch Generate Images

1. Select **Image** → **Batch Generate**
2. Set **Template ID**
3. Add **Items** — each item has its own set of modifications and optional webhook URL
4. Configure shared **Format**, **Quality**, **Scale**
5. Execute — returns a batch UID and individual render UIDs

### Check Render Status

1. Select **Image** → **Get Status**
2. Enter the **Render UID** from a previous async generation
3. Execute — returns the current status (`queued`, `processing`, `done`, `failed`) and `image_url` when complete

### Generate a Video

1. Select **Video** → **Generate**
2. Set **Template ID** to a template that contains a video layer
3. Add **Modifications** — picking a video object reveals **Video URL** (to swap
   the clip) and a **Video Settings** collection for trim, timing and audio
4. Set **Frame Rate** (1-60) and **Quality** (High / Balanced / Small). Leave
   **Duration** at 0 to derive it from the layers — the longest clip, or 5
   seconds, whichever is greater
5. Under **Options**, enable **Wait for Completion** to poll until the MP4 is ready
6. Execute — the output carries `video_url`, `poster_url`, `duration`, `fps` and
   `frame_count`

> Video renders are minutes of CPU, not milliseconds. The polling defaults are
> higher than the image ones for that reason; raise **Max Poll Attempts** further
> for long or high-frame-rate outputs.

### Check Video Render Status

1. Select **Video** → **Get Status**
2. Enter the **Render UID** (video UIDs start with `vid_`)
3. Execute — returns `status`, `progress` (0-100) and `video_url` when complete

Image and video jobs are served from separate endpoints: an `img_` UID is not
found by **Video → Get Status**, and vice versa.

---

## Modifications

When generating, you can modify template objects using these properties.

Entering the **Template ID** first populates the **Name** dropdown with that
template's editable objects, each tagged with its type, and the form then shows
only the inputs that type accepts.

| Property          | Type    | Description                              |
|-------------------|---------|------------------------------------------|
| `name`            | string  | **Required.** Object name in template     |
| `text`            | string  | Replacement text (text objects)           |
| `image_url`       | string  | Replacement image URL (image objects)     |
| `video_url`       | string  | Replacement clip URL (video objects)      |
| `trim_start`      | number  | Seconds into the clip where playback starts |
| `trim_end`        | number  | Seconds into the clip where playback stops  |
| `start_at`        | number  | Seconds into the output before the layer appears |
| `volume`          | number  | Audio volume, 0-2 (1 = original level)    |
| `muted`           | boolean | Drop this layer's audio                   |
| `loop`            | boolean | Repeat the clip to fill the output        |
| `fontFamily`      | string  | Override font family                      |
| `fontSize`        | number  | Override font size (1-1000)               |
| `fontWeight`      | string  | Override font weight (e.g. "bold")        |
| `fontStyle`       | string  | Override font style (e.g. "italic")       |
| `fill`            | string  | Override fill color (e.g. "#FF0000")      |
| `textAlign`       | string  | Override text alignment                   |
| `lineHeight`      | number  | Override line height (0.1-10)             |
| `height`          | number  | Override object height                    |
| `charSpacing`     | number  | Override character spacing                |
| `underline`       | boolean | Whether to set underline on the text      |
| `opacity`         | number  | Override opacity (0-1)                    |
| `backgroundColor` | string  | Override background color                 |

`image_url` and `video_url` must be publicly reachable http(s) URLs — the API
blocks private and loopback addresses, and drops such a modification with a
warning rather than fetching it.

Every field is optional bar `name`: an omitted key keeps whatever the template
has. That is also why **Format**, **Quality**, **Scale** and **Duration** have
an "inherit" default (`Template Default` / `0`) — the node omits them from the
request rather than sending a value the API would reject.

---

## Workflow Ideas

- **Social Media Automation**: Generate branded images from templates when new content is published
- **Certificate Generator**: Create personalized certificates on demand
- **E-commerce**: Generate product images with dynamic text overlays
- **Report Headers**: Create custom report header images with date/title info
- **Event Badges**: Batch generate attendee badges from a spreadsheet
- **Marketing Campaigns**: Batch create images with different text for A/B testing
- **Video Ads**: Render personalised MP4 variants from one template, swapping the
  clip or the overlaid text per item

---

## Compatibility

- **n8n**: 1.0+
- **Canolite**: 1.0+ (API v1) — the **Video** resource requires Canolite 1.8+

---

## License

[MIT](LICENSE)
