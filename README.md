# n8n-nodes-canolite

**n8n community node for [Canolite](https://github.com/AakashKhambhaliya/canolite)** — the self-hosted template-to-image generation platform.

Design templates visually in the Canolite editor, then generate images from them in your n8n workflows.

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

### 📄 Template Resource

| Operation    | Description                         |
|-------------|-------------------------------------|
| **Get**      | Retrieve a specific template        |
| **Get Many** | Retrieve all templates              |

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
3. Execute — returns the current status (`queued`, `rendering`, `done`, `failed`) and `image_url` when complete

---

## Modifications

When generating images, you can modify template objects using these properties:

| Property          | Type    | Description                              |
|-------------------|---------|------------------------------------------|
| `name`            | string  | **Required.** Object name in template     |
| `text`            | string  | Replacement text (text objects)           |
| `image_url`       | string  | Replacement image URL (image objects)     |
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

---

## Workflow Ideas

- **Social Media Automation**: Generate branded images from templates when new content is published
- **Certificate Generator**: Create personalized certificates on demand
- **E-commerce**: Generate product images with dynamic text overlays
- **Report Headers**: Create custom report header images with date/title info
- **Event Badges**: Batch generate attendee badges from a spreadsheet
- **Marketing Campaigns**: Batch create images with different text for A/B testing

---

## Compatibility

- **n8n**: 1.0+
- **Canolite**: 1.0+ (API v1)

---

## License

[MIT](LICENSE)
