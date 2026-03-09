<h1 align="center">
<h1 align="center">
  <br>
  AEGIS (Advanced Cloud Security)
  <br>
</h1>

<h4 align="center">Automated cloud security posture management and one-click remediation powered by AI</h4>

<p align="center">
  <a href="#about-the-project">About</a> •
  <a href="#how-it-works">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Configuration</a>
</p>

---

## About the Project
**AEGIS** is an intelligent security platform the acts as an automated guardian for your AWS infrastructure. Instead of just flagging misconfigurations with a list of overwhelming security errors, AEGIS leverages **Large Language Models (Amazon Nova via Bedrock)** to perform complex reasoning over cloud configurations and provide instant, one-click remediation plans straight to your dashboard.

### Core Features
- **Continuous AI Guardian**: Automated scanning of AWS services (S3, EC2, IAM) powered by intelligent compliance agents mapping to SOC2 standards.
- **One-Click Remediation**: AEGIS not only tells you what's broken but automatically generates the exact, safe CLI/API commands to fix security loopholes.
- **Dynamic Region Discovery**: Drop in your AWS credentials, and AEGIS instantly maps and discovers vulnerable resources across *all* active AWS regions with zero manual configuration.
- **Algorithmic Risk Prioritization**: Computes a dynamic risk score highlighting the most critical vulnerabilities so you know exactly where to start first.

## Architecture

![AEGIS Architect](https://i.imgur.com/placeholder-aegis-diagram.png) *(Note: Placeholder representation)*

AEGIS uses a modern, scalable, AI-first architecture split into distinct services:

### 1. The Frontend (`apps/web`)
A highly responsive single-page application built for security professionals and developers alike.
- **Framework**: `React v18` with `Vite` for lightning-fast builds
- **Styling**: `Tailwind CSS`, `Framer Motion` for micro-animations, and unstyled `Radix UI` components for a premium, accessible glassmorphism aesthetic.
- **Routing & Networking**: `React Router` and `Axios`

### 2. The Backend Engine (`apps/api`)
The core orchestration layer that communicates with your AWS environment and manages application state.
- **Server**: `Node.js` + `Express`
- **Data Store**: `Amazon DynamoDB` handles persistent fast storage of structural scan results, AI analysis, and remediation plans.
- **Auth**: Secured with `JWT` (JSON Web Tokens) and `Bcrypt`

### 3. The AI Reasoning Layer (`Amazon Bedrock`)
The "brain" of AEGIS operates directly via AWS.
- Custom reasoning agents (`compliance-reasoner`, `ec2-compliance-reasoner`, etc.) use the **Amazon Nova** model.
- Upon fetching the state of your infrastructure using the `AWS SDK`, the API hands the configuration metadata to Bedrock. The model synthesizes this against best practices, returning human-readable alerts and automated fixes.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- An active AWS Account (with programmatic access credentials)

### 1. Clone the Repository
```bash
git clone https://github.com/HashimZuraiqi/ACS-cloud.git
cd ACS-cloud
```

### 2. Install Dependencies
Because AEGIS is a monorepo setup, you'll need to install dependencies for both the frontend and the backend.

**Install Backend Dependencies:**
```bash
cd apps/api
npm install
```

**Install Frontend Dependencies:**
```bash
cd ../web
npm install
```

### 3. Environment Variables
You'll need to configure your backend with the required AWS and Auth variables. In `apps/api`, duplicate the provided `.env.example` file and rename it to `.env`:

```bash
cd apps/api
cp .env.example .env
```

While users provide their granular AWS credentials directly in the AEGIS web dashboard to perform scans, the backend itself requires AWS credentials to interact with **Amazon DynamoDB** (where it stores user data, scan schedules, and remediation plans) and **Amazon Bedrock** (to run the AI models).

Open your new `.env` file and populate it:

```env
# apps/api/.env
PORT=3000

# Backend Services AWS Credentials (DynamoDB & Bedrock)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_backend_access_key
AWS_SECRET_ACCESS_KEY=your_backend_secret_key

# JWT Auth for User Sessions
JWT_SECRET=super_secret_string_here
```

*(Note: Users provide their granular IAM credentials directly in the AEGIS web dashboard to perform scans).*

### 4. Running the Application

You can start both applications concurrently, or run them in separate terminal windows:

**Start the API Server:**
```bash
# In terminal 1
cd apps/api
npm run dev
```

**Start the Frontend Client:**
```bash
# In terminal 2
cd apps/web
npm run dev
```

Visit `http://localhost:3000` (or the port prescribed by Vite) to view the AEGIS dashboard. Drop in your AWS Access Key ID & Secret Access Key into the dashboard onboarding, and let the AI scan begin.

## Security Warning
AEGIS requests extensive `Read`/`Write` permissions within the connected AWS environment to evaluate configurations and run remediation commands. **We strongly recommend running this against a Sandbox or Dev AWS Environment initially.**

---
<p align="center">Made with ❤️ for a more secure cloud.</p>
