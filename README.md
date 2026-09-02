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

## How the node is laid out

Every job follows the same four steps, top to bottom:

**Resource** → **Operation** → **Template** → **Fields**

1. **Resource** — `Image` or `Video`
2. **Operation** — `Single Request`, `Synchronous Request`, `Batch Request` or `Get Status`
3. **Template** — pick it from the list, or switch to **By ID** to paste/expression a `tmpl_...`
4. **Fields** — the template's own objects, loaded live and rendered as one labelled input each

Nothing else is required. Encoder settings and the webhook live below that, and
**Options** stays collapsed until you want it.

### Operations

| Operation               | What it does                                                                 |
|-------------------------|------------------------------------------------------------------------------|
| **Single Request**      | Queues one render and returns its job UID straight away                       |
| **Synchronous Request** | Waits for the render and returns the finished `image_url` / `video_url`       |
| **Batch Request**       | Queues many renders from one template — up to 500 images, or 20 videos        |
| **Get Status**          | Looks up a queued render by its job UID                                       |

The two resources offer the same four operations. What differs:

- **Image** adds **Format** (PNG / JPEG / WebP), **Quality** (1-100) and **Scale** (1-3)
- **Video** adds **Frame Rate** (1-60), **Duration** and a **Quality** preset (High / Balanced / Small), and requires **Canolite 1.8+** with a template that contains a video layer

Image and video jobs live on separate endpoints, so an `img_` UID is not found
under **Video → Get Status**, and a `vid_` UID is not found under **Image**.

---

## Fields

Choosing a template loads its objects and renders one input per object, typed to
match: a text layer gets a text box, an image or video layer gets a URL box, and
a shape gets a colour. Text layers arrive pre-filled with whatever the template
already says, so you only change what you mean to change.

Less common overrides are one click away under **Add field** rather than always
on screen:

| Object type | Always shown  | Under **Add field**                                          |
|-------------|---------------|--------------------------------------------------------------|
| Text        | the text      | Font Size, Colour                                            |
| Image       | Image URL     | —                                                            |
| Video       | Video URL     | Trim Start, Trim End, Start At, Volume, Muted, Loop          |
| Shape       | —             | the fill colour                                              |

Leave a field empty and it is left out of the request entirely, which the API
reads as "keep whatever the template has". That is also why **Format**,
**Quality**, **Scale** and **Duration** default to an inherit marker
(`Template Default` / `0`) — sending `""` or `0` would be rejected, so the node
omits the key instead.

`image_url` and `video_url` must be publicly reachable http(s) URLs. The API
blocks private and loopback addresses, dropping such a change with a warning
rather than fetching it.

**Batch Request** is the one exception to the Fields form. A resource mapper
describes a single set of values, and a batch needs a different set per output,
so batch keeps a repeating **Items** list where each item has its own
**Modifications** and optional per-item webhook.

---

## Waiting for a render

**Synchronous Request** blocks the node until the file is ready, but the two
resources get there differently, and only the video one needs a setting from you.

**Image** renders inside the HTTP request and answers with the `image_url`.
Nothing to configure.

**Video** cannot: encoding runs for minutes, and a request held open that long
dies at any reverse proxy in front of Canolite. So the API always queues the job,
and the node does the waiting by polling — which is why the video panel adds:

| Field                         | Default | Meaning                                                        |
|-------------------------------|---------|----------------------------------------------------------------|
| **Max Wait Time (Seconds)**   | `600`   | Give up after this long. Type any value from 1 to 3600.        |
| **Poll Interval (Seconds)**   | `5`     | Under **Options**. How often to check. Does not affect render speed. |

As a rough guide, a 15-second clip at 30fps takes a couple of minutes on modest
hardware. Set **Max Wait Time** to cover your longest video, and make sure the
workflow's own execution timeout is at least as generous.

If the wait runs out, nothing is cancelled — the job keeps rendering on the
server, and the error carries its UID so **Get Status** can still collect it.

---

## Usage examples

### Render one image and use it immediately

1. **Resource** → `Image`, **Operation** → `Synchronous Request`
2. **Template** → pick your template from the list
3. Fill in the **Fields** that appeared
4. Execute — the output carries `image_url`

### Render one video and wait for the MP4

1. **Resource** → `Video` (the template list now shows only templates with a video layer)
2. **Operation** → `Synchronous Request`
3. **Template** → pick one, then fill in the **Fields**
4. Set **Max Wait Time (Seconds)** to cover your longest render
5. Execute — the output carries `video_url`, `poster_url`, `duration`, `fps` and `frame_count`

### Fire and forget, collect later

1. **Operation** → `Single Request` — the output is `{ uid, status: "queued" }`
2. Later, **Operation** → `Get Status` with that **Render UID**, or set a
   **Webhook URL** under **Options** and let Canolite call you

### Batch from a spreadsheet

1. **Operation** → `Batch Request`, pick the **Template**
2. Add an **Item** per output, each with its own **Modifications**
3. Execute — returns a batch UID and the individual render UIDs

---

## Upgrading from 1.x

**2.0 is a clean break.** The panel was rebuilt around
Resource → Operation → Template → Fields, and the old parameter names are gone,
so Canolite nodes saved with 1.x need setting up again after the upgrade.

What changed:

- **Operations renamed.** `Generate` → **Single Request**, `Generate (Synchronous)` → **Synchronous Request**, `Batch Generate` → **Batch Request**.
- **Video gained a Synchronous Request.** 1.x had none.
- **`Wait for Completion` is gone.** Choosing `Single Request` vs `Synchronous Request` is now the whole decision. The video wait is a plain **Max Wait Time (Seconds)** instead of Poll Interval × Max Poll Attempts.
- **The Template resource is gone.** Templates are browsed from the **Template** picker itself; `has_video` filtering happens automatically when the resource is `Video`.
- **Modifications became Fields.** Instead of adding rows and picking an object per row, the template's objects are rendered as inputs directly. The old list survives only inside **Batch Request** items.

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
