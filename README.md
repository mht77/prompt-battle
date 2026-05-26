# AI Prompt Battle Game

A real-time multiplayer online game where an Admin narrating the game projects an AI-generated image (using Gemini), and players compete to write prompts that generate an image as close as possible to the target image in 1 minute. The submissions are rated by other players and Gemini, with real-time sync via WebSockets.

---

## Folder Structure

- `/backend` - Django, Django REST Framework, Django Channels.
- `/frontend` - React + Vite, styled using modern Vanilla CSS.
- `Dockerfile` - Multi-stage container packaging both frontend and backend.
- `.github/workflows/deploy.yml` - CI/CD pipeline to deploy to Google Cloud Run.

---

## Local Setup

### 1. Backend (Django)
Ensure you have Python 3.11+ installed.

1. Navigate to `/backend`.
2. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set your Gemini API key (optional; defaults to mock mode if not provided):
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```
5. Apply migrations:
   ```bash
   python manage.py migrate
   ```
6. Start the server (using Daphne for WebSocket support):
   ```bash
   daphne -b 0.0.0.0 -p 8000 core.asgi:application
   ```

### 2. Frontend (React)
Ensure you have Node.js 18+ installed.

1. Navigate to `/frontend`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

Open your browser and visit:
- Admin/Player HUD: `http://localhost:5173/`

---

## Production Deployment (Google Cloud Run)

To build and run the Docker container locally or in production:

```bash
docker build -t prompt-battle .
docker run -p 8080:8080 -e GEMINI_API_KEY="your_key" prompt-battle
```
This multi-stage Docker build compiles the React bundle, embeds it into Django's static directories, collects static assets via WhiteNoise, and launches the Daphne ASGI server.
