# n8n-nodes-canolite

**n8n community node for [Canolite](https://github.com/AakashKhambhaliya/canolite)** — the self-hosted template-to-image and video generation platform.

Design templates visually in the Canolite editor, then generate images and MP4 videos from them in your n8n workflows.

---

## What's new in 2.1

- **Real error messages.** A failed render now says why — e.g. `Render failed: Remote image returned HTTP 403` — instead of n8n's generic *"Your request is invalid or could not be processed by the service"*. See [Errors](#errors) and [Troubleshooting](#troubleshooting).
- **Template resource** — list your templates (**Get Many**) or read one with its editable fields (**Get**).
- **Wait for Completion** for **Batch** (one output item per finished image/video) and **Get Status**.
- **Download File** — attach the finished image or MP4 as binary data for Gmail, Google Drive, Slack…
- **Fail on Warnings** and **Fail If Any Job Fails** options.
- **Video Scale**, and Scale up to **4x** for images and video.
- Video **Frame Rate** and **Quality** now default to **Template Default**, so your template's and project's video settings are respected.

Full details in the [CHANGELOG](CHANGELOG.md).

---

## Installation

### In n8n (Community Nodes)

1. Go to **Settings → Community Nodes**
2. Click **Install a community node**
3. Enter `n8n-nodes-canolite`
4. Click **Install**

### Updating

**Settings → Community Nodes → n8n-nodes-canolite → Update**, then reload the
editor. Existing 2.x workflows keep working; no nodes need to be set up again.

### Manual Installation

```bash
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install n8n-nodes-canolite
```

Restart n8n after installation. In Docker, run this inside the container's
`/home/node/.n8n/nodes` folder (on a mounted volume, so it survives restarts).

---

## Credentials

You need a Canolite API key. Create one in your Canolite dashboard under **API Keys**.

| Field     | Description                                           | Example                      |
|-----------|-------------------------------------------------------|------------------------------|
| Base URL  | The root URL of your Canolite instance — the address you open in the browser, without `/api` or `/v1` | `https://canolite.example.com` |
| API Key   | Your API key (starts with `sk_live_`)                 | `sk_live_abc123...`          |

A trailing slash in the Base URL, or whitespace around a pasted key, is handled for you.

---

## How the node is laid out

Every job follows the same four steps, top to bottom:

**Resource** → **Operation** → **Template** → **Fields**

1. **Resource** — `Image`, `Video` or `Template`
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

- **Image** adds **Format** (PNG / JPEG / WebP), **Quality** (1-100) and **Scale** (1-4)
- **Video** adds **Frame Rate** (1-60), **Duration**, a **Quality** preset (High / Balanced / Small) and **Scale** (1-4), and requires **Canolite 1.8+** with a template that contains a video layer

Every output setting defaults to **Template Default** (or `0`), which leaves it out
of the request so Canolite applies its own precedence: project defaults → template
settings → this request.

Image and video jobs live on separate endpoints, so an `img_` UID is not found
under **Video → Get Status**, and a `vid_` UID is not found under **Image**.

The **Template** resource has **Get Many** (with Return All / Limit, a name search and
a *Video Templates Only* filter) and **Get**, which returns the template with its
editable `fields` — handy for building modifications dynamically.

### Options

| Option                    | Operations                         | What it does |
|---------------------------|------------------------------------|--------------|
| **Wait for Completion**   | Batch, Get Status                  | Waits until the job(s) finish. Batch then outputs **one item per job** with its `image_url` / `video_url`. |
| **Max Wait Time / Poll Interval** | Batch, Get Status (and video Synchronous) | How long to wait and how often to check. |
| **Fail If Any Job Fails** | Batch                              | Off: failed jobs come back as items with `status: "failed"` and their `error`. On: the node fails. |
| **Download File**         | Synchronous, Batch, Get Status     | Downloads the finished file into binary data (property **Binary Property**, default `data`) for Gmail, Drive, Slack… |
| **Fail on Warnings**      | Single, Synchronous, Batch         | Treats Canolite warnings (unknown field name, refused `image_url`) as errors. |
| **Webhook URL**           | Single, Synchronous                | Canolite calls this URL when the render finishes. |

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
A brief network or 5xx blip while polling is retried rather than failing the node.

---

## Errors

The node shows Canolite's own error message, not a generic HTTP sentence, plus a
hint about what to do:

| Situation | What you see |
|-----------|--------------|
| A synchronous render failed (HTTP 422) | `Render failed: Remote image returned HTTP 403` — the reason, the render UID, and any warnings |
| Bad parameters (400) | `Canolite rejected the request: Validation error` with each invalid field listed |
| Bad or revoked API key (401) | `Canolite rejected the API key` |
| Wrong template ID / render UID (404) | `Template not found` / `Render job not found` |
| Server busy (429) | `Canolite is busy…` with the Retry-After time — turn on **Retry On Fail** in node settings |
| Base URL points somewhere else, or a proxy error page | `Canolite returned HTTP 502 with a non-JSON response` and how to fix the Base URL |
| Canolite can't be reached at all | `Could not reach Canolite at https://…` |
| A failed job while waiting (Get Status / Batch) | The item comes back with `status: "failed"` and `error` (Synchronous Request fails the node instead) |

The template picker and the **Fields** form use the same messages, so a wrong key
or Base URL is explained right in the editor.

`Continue On Fail` / **On Error → Continue** work as usual.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Render failed: Remote image returned HTTP 403` (or 400) | The image host refused the download. Many sites block hotlinking (e.g. Pixabay, Wikimedia). | Upload the image to Canolite, or use a host that allows direct downloads. For Google Drive, share the file as *Anyone with the link* and use a direct-download link. |
| `Render failed: Some layers could not be opened. Check that these image layers point to…` | An image layer's source can't be loaded by the renderer. The message names the layer. | Re-upload that image in the Canolite editor, or replace it with a public `image_url` field. |
| `Render failed: … Chromium sandboxing failed! … No usable sandbox` | Canolite 1.12.0–1.12.1 running in Docker / Coolify. | Update Canolite to **1.12.2 or later** and redeploy. |
| `Canolite rejected the request: Template does not contain video layers` | A Video operation on an image-only template. | Use the **Image** resource, or add a video layer to the template. |
| `Render … did not complete within 600s` | The video took longer than **Max Wait Time**. | Raise **Max Wait Time**; the job keeps rendering, and **Get Status** with its UID can still collect it. |
| `Canolite reported N warning(s)` | **Fail on Warnings** is on and Canolite warned (e.g. a field name that matches no layer). | Fix the field names in the template, or turn the option off — warnings are then returned in the `warnings` field. |
| `Could not download https://…` (Download File) | n8n can't reach the URL Canolite returned. | Set `APP_URL` in Canolite to the public address n8n uses. |

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
4. Or turn on **Options → Wait for Completion** (and **Download File**) to get one
   item per finished image, ready for the next node

### Render an image and email it

1. **Image** → **Synchronous Request**, pick the template, fill in the **Fields**
2. **Options → Download File** on (binary property `data`)
3. Connect a **Gmail** (or **Send Email**) node and attach the binary property `data`

### Collect a queued render later and save it to Drive

1. **Single Request** → output `{ uid, status: "queued" }`
2. Next node: **Get Status** with **Render UID** = `{{ $json.uid }}`,
   **Options → Wait for Completion** and **Download File** on
3. Connect **Google Drive → Upload** with the binary property `data`

### List templates in a workflow

1. **Resource** → `Template`, **Operation** → `Get Many`
2. Optional **Filters** → *Search* or *Video Templates Only*
3. Each template becomes one item with `template_id`, `name`, `width`, `height`
   and `has_video`; use **Get** to read a template's editable `fields`

---

## Upgrading from 1.x

**2.0 is a clean break.** The panel was rebuilt around
Resource → Operation → Template → Fields, and the old parameter names are gone,
so Canolite nodes saved with 1.x need setting up again after the upgrade.

What changed:

- **Operations renamed.** `Generate` → **Single Request**, `Generate (Synchronous)` → **Synchronous Request**, `Batch Generate` → **Batch Request**.
- **Video gained a Synchronous Request.** 1.x had none.
- **Waiting is chosen by operation.** `Single Request` returns straight away and `Synchronous Request` waits. The video wait is a plain **Max Wait Time (Seconds)** instead of Poll Interval × Max Poll Attempts. (2.1 adds **Wait for Completion** back as an option on **Batch** and **Get Status**.)
- **Templates are browsed from the Template picker.** `has_video` filtering happens automatically when the resource is `Video`. (2.1 adds a read-only **Template** resource back for listing templates in a workflow.)
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

- **n8n**: 1.0+ (tested on n8n 2.48)
- **Canolite**: 1.0+ (API v1) — the **Video** resource requires Canolite 1.8+; video **Scale** and Scale 4 need 1.11+.
  **Recommended: Canolite 1.12.2 or later** — 1.12.0 and 1.12.1 cannot render inside Docker / Coolify.
  Tested against Canolite 1.12.2.

---

## License

[MIT](LICENSE)
