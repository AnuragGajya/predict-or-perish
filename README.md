# 🔮 Predict or Perish
### Live multiplayer intelligence game — Alice in Borderland inspired

A real-time multiplayer game for college events. Players submit numbers, the target is **80% of the average**, and whoever is **farthest from the target gets eliminated**.

---

## 🎮 How to Play

1. Host opens the **Host Dashboard** on a laptop/projector
2. Players join via their **phones** using the Player page
3. Host clicks **Start Round** — players submit numbers (0–100)
4. Host clicks **Calculate** — system finds the target and eliminates the farthest player
5. Repeat until host clicks **End Game**

---

## 🚀 Running Locally

### Prerequisites
- Node.js v16 or higher

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/predict-or-perish.git
cd predict-or-perish

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
# Host: http://localhost:3000/host.html
# Players: http://localhost:3000/player.html
```

For players on phones — make sure all devices are on the **same WiFi network**, then share your laptop's local IP (e.g. `http://192.168.1.x:3000/player.html`).

---

## ☁️ Deploying to Railway (Free Hosting)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and sign in with GitHub
3. Click **New Project → Deploy from GitHub repo**
4. Select this repo — Railway auto-detects Node.js
5. Your app will be live at a public URL like `https://predict-or-perish.up.railway.app`
6. Share the URL with players — no WiFi restriction!

> **Render.com** also works: go to [render.com](https://render.com), create a new **Web Service**, connect GitHub repo, set build command `npm install` and start command `npm start`.

---

## 📁 Project Structure

```
predict-or-perish/
├── server.js           # Node.js + Socket.io backend
├── package.json
├── public/
│   ├── index.html      # Home page (role selector)
│   ├── player.html     # Player mobile interface
│   ├── host.html       # Host dashboard (projector)
│   ├── css/
│   │   └── style.css   # Dark dramatic theme
│   └── js/
│       ├── player.js   # Player socket logic
│       └── host.js     # Host dashboard logic
```

---

## ⚙️ Tech Stack

| Layer    | Technology          |
|----------|---------------------|
| Backend  | Node.js + Express   |
| Realtime | Socket.io           |
| Frontend | HTML + CSS + JS     |
| Hosting  | Railway / Render    |

---

## 🎨 Design

Dark, dramatic aesthetic inspired by Alice in Borderland — scanline effects, monospace fonts, red/green elimination color coding, projector-ready host dashboard.
