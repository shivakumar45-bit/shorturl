# SwiftLink URL Shortener

A small real URL shortener. The server stores each short code and redirects visitors
from `/{code}` to the original long URL.

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Public Sharing

Localhost links only work on your own computer. To send short links to other people,
deploy this app to a public host such as Render, Railway, Fly.io, or a VPS, then use
your deployed domain.

Example:

```text
https://your-domain.com/a7k2
```

The app stores links in `data/links.json`. For production traffic, replace that file
with a hosted database such as PostgreSQL, SQLite on persistent disk, or MongoDB.

## Deploy to Fly.io

1. Install the Fly CLI: https://fly.io/docs/flyctl/install/
2. Log in:

```bash
fly auth login
```

3. Copy the example config:

```bash
copy fly.toml.example fly.toml
```

4. Edit `fly.toml` and change `app = "your-unique-app-name"` to a unique name.
5. Create the app:

```bash
fly apps create your-unique-app-name
```

6. Create a persistent volume for saved links:

```bash
fly volumes create swiftlink_data --size 1 --region bom
```

7. Deploy:

```bash
fly deploy
```

8. Open it:

```bash
fly apps open
```
