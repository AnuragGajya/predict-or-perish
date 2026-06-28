# 🔮 Predict or Perish

**A live multiplayer "guess the target number" elimination game — Alice in Borderland inspired.**

Built for college events, parties, and icebreakers. Players join from their phones, the host runs the show from a laptop or projector, and every round someone gets eliminated until one player remains.

**🔗 Live demo:** [predict-or-perish.onrender.com](https://predict-or-perish.onrender.com/)

---

## 🎮 How to Play

1. **Host** opens the Host Dashboard and creates a room with a code.
2. **Players** open the Player page on their phones, enter their name and the room code, and join.
3. Host clicks **Start Round** — every active player submits a number between **0 and 100**.
4. Host clicks **Show Result**. The system calculates:
   - **Average** of all submitted numbers
   - **Target** = Average × 0.8
   - Whoever is **closest** to the target wins the round
   - Whoever is **farthest** from the target is eliminated
5. Host moves to the **next round** and repeats.
6. The game ends once only **two players remain** — the round result on that final round decides the winner.

---

## ✨ Features

- **Room-code based sessions** — multiple games can run independently on the same server
- **Real-time updates** via Socket.io — no page refreshes needed
- **Live submission tracking** — host dashboard shows who has/hasn't submitted, without revealing numbers mid-round
- **Host-controlled reveal** — results (and round numbers) are only sent to players once the host shows them
- **Reconnect with host approval** — if a player's connection drops mid-game, they can rejoin with the same name, but the host must approve the rejoin
- **Automatic elimination tracking** — eliminated players and their elimination round are tracked for end-game recap
- **Dark, dramatic UI** — scanline/noise overlay, monospace fonts, red/green elimination color coding, designed to look good projected on a big screen

---

## 🚀 Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/predict-or-perish.git
cd predict-or-perish

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# or, for auto-restart on file changes during development:
npm run dev
```

By default the server runs on **port 8080**:

```
http://localhost:8080
```

From there:
- **Home page:** `http://localhost:8080/index.html`
- **Host Dashboard:** `http://localhost:8080/host.html`
- **Player page:** `http://localhost:8080/player.html`

> **Note:** the steps above are for local development only. The live game runs on Render (see the demo link at the top) — players can join from **any network, anywhere**, no WiFi restrictions. This has been tested live with 30–40 players joining simultaneously from different networks.

---

## ☁️ Deployment

### Render.com

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) and sign in with GitHub.
3. Create a new **Web Service** and connect this repo.
4. Render assigns the port automatically via `process.env.PORT`, so no changes needed.
5. The server includes a built-in keep-alive ping (every 10 minutes) to help avoid Render's free-tier cold starts — just make sure the `RENDER_EXTERNAL_URL` environment variable is set (Render sets this automatically on most plans).

> **Note:** on Render's free tier, the service spins down after inactivity, so the very first load after a period of idle time can take 30–60 seconds to wake up. Give it a moment before players start joining.

### Railway.app

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) and sign in with GitHub.
3. **New Project → Deploy from GitHub repo** → select this repo. Railway auto-detects Node.js and runs `npm start`.
4. Share the generated public URL with players — no WiFi restrictions needed.

---

## 📁 Project Structure

```
predict-or-perish/
├── server.js              # Express + Socket.io backend — game logic, rooms, rounds
├── package.json
├── public/
│   ├── index.html          # Home page (role selector)
│   ├── player.html         # Player mobile interface
│   ├── host.html            # Host dashboard (projector view)
│   ├── css/
│   │   └── style.css      # Dark, dramatic theme
│   └── js/
│       ├── player.js      # Player-side Socket.io client logic
│       └── host.js        # Host-side Socket.io client logic
```

---

## ⚙️ Tech Stack

| Layer     | Technology               |
|-----------|---------------------------|
| Backend   | Node.js + Express         |
| Realtime  | Socket.io                 |
| Frontend  | HTML + CSS + vanilla JS   |
| Hosting   | Render / Railway          |

---

## 🎨 Design

Dark, dramatic aesthetic inspired by Alice in Borderland — scanline and noise overlay effects, monospace + condensed display fonts, red/green elimination color coding, and a host dashboard built to be read clearly from across a room.

---

## 📝 License

This project doesn't currently specify a license. Add one (e.g. MIT) if you plan to share or open-source it publicly.
