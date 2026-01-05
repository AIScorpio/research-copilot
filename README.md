# Research Copilot: Enhanced AI Paper Management

A powerful, full-stack research management platform designed for deep technical analysis of academic and industrial papers, with a focus on AI in Banking.

## ✨ Key Features

### 🚀 Smart Collection
- **Auto-Collect**: One-click collection of the latest papers on specific themes (e.g., AI in Banking).
- **Multi-Source Pipeline**: Integrated search across ArXiv, Semantic Scholar, and more.
- **Custom Filters**: Drill down by publication date, source, and research sector.

### 🧠 AI-Powered Intelligence
- **Real-time Technical Summaries**: On-demand deep-dive analysis using LLMs (Groq Llama 3.3).
- **Auto-Tagging**: AI-suggested research topics and industrial categories with a one-click approval workflow.
- **Context-Aware RAG Chat**: Chat with your entire paper library using Retrieval-Augmented Generation for cited, specific answers.

### 📊 Advanced Dashboard
- **MacOS-Style Interactive Charts**: "Magnetic" zoom effects on research volume and methodology distribution.
- **Intelligence Panels**: Stable, high-readout info panels for quick data inspection.
- **Collection History**: Interactive calendar popup showing daily research growth.

### 🛠️ Repository Management
- **Action Menu**: Hover over any paper card to quickly delete or edit metadata.
- **Metadata Correction**: Directly edit publication dates to ensure library accuracy.
- **Custom Tagging**: Manage your own taxonomy alongside AI-generated tags.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Database**: Prisma with SQLite
- **UI Architecture**: Tailwind CSS + Shadcn UI + Recharts
- **AI/LLM**: Groq SDK (Llama 3.3)
- **Search Integrations**: ArXiv, Semantic Scholar

---

## 🚀 Local Setup

### 1. Requirements
- Node.js 18+
- A [Groq API Key](https://console.groq.com/) for AI features.

### 2. Installation
```bash
git clone <your-repo-url>
cd researcher
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL="file:./dev.db"
LLM_PROVIDER="groq"
GROQ_API_KEY="your_groq_key_here"
```

### 4. Database Setup
```bash
npx prisma db push
npx prisma generate
```

### 5. Start Application
```bash
npm run dev
```

---

## 🚢 GitHub Deployment Guidance

### Pushing to a New Repository
1. **Create a new empty repository** on your GitHub account.
2. **Open your terminal** in this project folder.
3. **Execute the following commands**:

```bash
# Initialize git if not already done
git init

# Add all project files
git add .

# Commit changes
git commit -m "Initial release: Enhanced Research Copilot"

# Rename branch to main
git branch -M main

# Add your GitHub repository as the remote
# REPLACE with your actual repo URL
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

> [!IMPORTANT]
> **Do NOT push your `.env` file!** It contains sensitive API keys. The `.gitignore` is already configured to skip it.
