# Running Chito in one container

One Docker image runs everything on a single address and port:

| Path | What |
|---|---|
| `/` | Customer web app |
| `/admin` | Store dashboard |
| `/rider` | Rider web app |
| `/api/v1` | The API (and live updates over Socket.io) |
| `/health` | `{"ok":true,"db":true}` when the server and database are up |

The database stays on **MongoDB Atlas** (not inside the container). The Android APKs keep using the Render server; this container is for the websites.

## 1. Settings

Copy `chito.env.example` to `chito.env` and fill it in. The must-haves:

- `MONGODB_URI`: the same Atlas string as `apps/api/.env`. In Atlas → **Network Access**, allow the platform's IP (or `0.0.0.0/0`).
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: two different random strings, 32+ characters each.
- `PUBLIC_API_URL`: the address the platform gives the app, e.g. `https://chito.example.edu`. Razorpay sends people back here after paying.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: for online payment (test keys are fine).

Demo mode is on by default (OTP is always **1234**, orders at any hour), the same as the Render setup.

## 2. Build and run

```bash
docker build -t chito .
docker run -d --name chito -p 4000:4000 --env-file chito.env --restart unless-stopped chito
```

Open `http://<server>:4000/`, `/admin` and `/rider`. If the platform only builds from a Git repo, point it at this repository: the `Dockerfile` is at the root and needs no build settings. The container listens on the `PORT` variable (default **4000**), so set that if the platform assigns a port.

The first build takes a few minutes and needs about **4 GB of memory** (it builds the three web apps). The final image only contains Node, the API and the built pages.

## 3. Good to know

- Secrets are never inside the image; they come from `chito.env` / the platform's environment settings when the container starts.
- Admin login uses the same email and password as the live dashboard (they're in the database).
- To use a different photo host or support number in the web apps: `docker build --build-arg IMAGEKIT_URL_ENDPOINT=… --build-arg SUPPORT_PHONE=… -t chito .`
- Logs: `docker logs -f chito`. Health: `docker inspect --format '{{.State.Health.Status}}' chito`.
