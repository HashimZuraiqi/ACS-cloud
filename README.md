<h1 align="center">
  <br>
  AEGIS — Advanced Cloud Security
  <br>
</h1>

<h4 align="center">Automated cloud security scanning and one-click remediation powered by AI</h4>

<p align="center">
  <a href="#what-is-aegis">What is AEGIS?</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#step-by-step-setup">Setup Guide</a> •
  <a href="#using-aegis">Using AEGIS</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#faq">FAQ</a>
</p>

---

## What is AEGIS?

AEGIS is a **security tool for Amazon Web Services (AWS)**. If you have an AWS account with resources like S3 buckets, EC2 instances, or IAM users, AEGIS can:

1. **Scan** your AWS resources to find security problems (like publicly exposed data or missing encryption)
2. **Explain** each problem in plain English using AI (Amazon Nova via Bedrock)
3. **Fix** problems automatically with one click — no manual AWS Console work needed
4. **Score** your security posture so you know how safe your infrastructure is at a glance

> **Think of it like a security guard for your cloud** — it patrols your AWS account, finds unlocked doors, and locks them for you.

---

## How It Works

AEGIS has three main parts:

### 1. The Dashboard (Frontend)
This is the website you interact with. It shows your scan results, risk scores, and lets you approve fixes.

- Built with **React** and **Vite**
- Uses **Tailwind CSS** for styling
- Runs on `http://localhost:5173` by default

### 2. The API Server (Backend)
This is the engine that talks to your AWS account, runs scans, and stores results.

- Built with **Node.js** and **Express**
- Stores data in **Amazon DynamoDB** (a cloud database)
- Runs on `http://localhost:3000` by default

### 3. The AI Brain (Amazon Bedrock)
AEGIS uses **Amazon Nova** (an AI model) to analyze your security findings and generate human-readable explanations. This runs inside your own AWS account via Amazon Bedrock — no external AI services needed.

---

## Step-by-Step Setup

Follow these steps **in order**. Each step builds on the previous one.

### Prerequisites (What You Need First)

Before starting, make sure you have these installed on your computer:

| Tool | Minimum Version | How to Check | Download Link |
|------|----------------|-------------|--------------|
| **Node.js** | v18 or higher | Run `node --version` in your terminal | [nodejs.org](https://nodejs.org/) |
| **npm** | Comes with Node.js | Run `npm --version` | Included with Node.js |
| **Git** | Any recent version | Run `git --version` | [git-scm.com](https://git-scm.com/) |

You also need an **AWS Account**. If you don't have one yet, follow the AWS setup section below. If you already have one with access keys, skip ahead to [Step 1: Clone the Repository](#step-1-clone-the-repository).

---

### AWS Setup (Detailed Walkthrough)

AEGIS needs two things from AWS:
1. **Access Keys** — a pair of credentials (Access Key ID + Secret Access Key) that let the AEGIS backend talk to AWS services
2. **Bedrock Model Access** — permission to use the Amazon Nova AI model

Here's how to set both up from scratch:

#### Part A: Create an AWS Account (Skip if you already have one)

1. Go to [https://aws.amazon.com/free/](https://aws.amazon.com/free/)
2. Click **"Create a Free Account"**
3. Enter your email address and choose an AWS account name (e.g., `my-aegis-account`)
4. Verify your email with the code AWS sends you
5. Set your **Root user password** (save this somewhere safe)
6. Choose **"Personal"** for account type
7. Enter your contact info and payment method (AWS won't charge you — the free tier covers what AEGIS needs)
8. Complete the identity verification (phone or text)
9. Select the **"Basic Support — Free"** plan
10. Click **"Complete Sign Up"**

> **What just happened?** You created an AWS cloud account. Think of it like a Google account, but for cloud computing services.

#### Part B: Create an IAM User (Don't use the Root account)

Your root account should not be used for day-to-day access. Instead, create a dedicated **IAM user** for AEGIS:

1. Sign in to the [AWS Console](https://console.aws.amazon.com/) with your root account
2. In the **search bar** at the top, type **"IAM"** and click on **"IAM"** (Identity and Access Management)
3. In the left sidebar, click **"Users"**
4. Click the **"Create user"** button (top right)
5. For **User name**, type: `aegis-backend`
6. Click **"Next"**
7. On the **"Set permissions"** page:
   - Select **"Attach policies directly"**
   - In the search box, search for and check these policies:
     - ✅ `AmazonDynamoDBFullAccess` — lets AEGIS create and manage its database tables
     - ✅ `AmazonBedrockFullAccess` — lets AEGIS call the AI model
   - If you also want this same user for scanning (simpler setup), also add:
     - ✅ `AmazonS3ReadOnlyAccess`
     - ✅ `AmazonEC2ReadOnlyAccess`
     - ✅ `IAMReadOnlyAccess`
8. Click **"Next"**, then **"Create user"**

> **What just happened?** You created a new AWS user called `aegis-backend` with permissions to use DynamoDB (database) and Bedrock (AI). This is like creating a separate login for the app instead of using your master password.

#### Part C: Create Access Keys

Now you need to generate the Access Key ID and Secret Access Key that AEGIS will use:

1. You should still be in the IAM dashboard. Click on **"Users"** in the left sidebar
2. Click on the user you just created: **`aegis-backend`**
3. Click the **"Security credentials"** tab
4. Scroll down to **"Access keys"** section
5. Click **"Create access key"**
6. For the use case, select **"Application running outside AWS"**
7. Click **"Next"**
8. (Optional) Add a description like `AEGIS backend keys`
9. Click **"Create access key"**
10. **⚠️ IMPORTANT: You will see your Access Key ID and Secret Access Key on this screen. This is the ONLY time the Secret Access Key is shown.** Copy both values and save them somewhere safe (like a password manager):

    ```
    Access Key ID:     AKIA1234567890EXAMPLE
    Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    ```

11. Click **"Done"**

> **What just happened?** You generated a username/password pair (Access Key ID + Secret) that AEGIS will use to authenticate with AWS. Think of it like an API key.

#### Part D: Enable Amazon Bedrock Model Access

AEGIS uses the **Amazon Nova Lite** AI model via Amazon Bedrock. You need to enable it first:

1. In the AWS Console, make sure your **region** is set to **US East (N. Virginia) / us-east-1**
   - Check the top-right corner of the AWS Console — there's a region dropdown
   - Click it and select **"US East (N. Virginia)"** if it's not already selected
2. In the **search bar** at the top, type **"Bedrock"** and click **"Amazon Bedrock"**
3. In the left sidebar, scroll down and click **"Model access"** (under "Bedrock configurations")
4. Click **"Modify model access"** (top right)
5. Find **"Amazon"** in the provider list and expand it
6. Check the box next to **"Nova Lite"** (this is the model AEGIS uses)
7. Click **"Next"**, then **"Submit"**
8. Wait about 1–2 minutes for the status to change from "In Progress" to **"Access granted"**

> **What just happened?** You told AWS "I want to use the Amazon Nova AI model." By default, AI models in Bedrock are disabled until you explicitly request access. Now AEGIS can call the model to analyze your security findings.

#### Part E: Create a Custom IAM Policy for Scanning (Optional but Recommended)

If you want AEGIS to also **auto-fix** security issues (not just scan), you need to give the scanning credentials write permissions. You can create a custom policy:

1. Go to **IAM** → **Policies** (left sidebar) → **"Create policy"**
2. Click the **"JSON"** tab
3. Delete everything in the editor and paste the full policy from the [AWS Permissions](#aws-permissions) section below
4. Click **"Next"**
5. Name the policy: `AEGISScanAndRemediate`
6. Click **"Create policy"**
7. Now go to **IAM** → **Users** → click your `aegis-backend` user → **"Add permissions"** → **"Attach policies directly"**
8. Search for `AEGISScanAndRemediate`, check it, and click **"Add permissions"**

> **What just happened?** You created a permission list that tells AWS exactly what AEGIS is allowed to do — read S3 buckets, read EC2 instances, and make security fixes like blocking public access. Without this policy, AEGIS can analyze but not fix issues.

> **💡 Tip:** If you want to use separate AWS accounts for the backend and scanning, you can create two different IAM users with two different sets of access keys. The `.env` file uses the backend keys, and you enter the scanning keys in the AEGIS web dashboard.

---

### Step 1: Clone the Repository

Open your terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
git clone https://github.com/HashimZuraiqi/ACS-cloud.git
```

This downloads all the AEGIS code to your computer. Now navigate into the project folder:

```bash
cd ACS-cloud
```

> **What just happened?** You downloaded the entire AEGIS project from GitHub to a folder called `ACS-cloud` on your computer.

---

### Step 2: Install Backend Dependencies

The backend (API server) needs several packages to work. Install them:

```bash
cd apps/api
npm install
```

This will take 1–2 minutes. You'll see a progress bar as packages download.

> **What just happened?** npm read the `package.json` file and downloaded all the libraries the backend needs (like Express, the AWS SDK, etc.) into a `node_modules` folder.

---

### Step 3: Install Frontend Dependencies

Now install the packages for the dashboard website:

```bash
cd ../web
npm install
```

> **What just happened?** Same as Step 2, but for the frontend. It downloaded React, Vite, Tailwind CSS, and other UI libraries.

---

### Step 4: Set Up Your Environment Variables

The backend needs to know your AWS credentials and a secret key for user authentication. You'll create a configuration file called `.env`.

**Navigate to the API folder:**

```bash
cd ../api
```

**Create the `.env` file:**

On **Mac/Linux**:
```bash
touch .env
```

On **Windows** (Command Prompt):
```cmd
echo. > .env
```

**Open the `.env` file** in any text editor (VS Code, Notepad, etc.) and paste this content:

```env
# The port the API server runs on
PORT=3000

# Your AWS credentials for DynamoDB (database) and Bedrock (AI)
# These are YOUR backend AWS credentials, not the ones users enter in the dashboard
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=paste_your_access_key_here
AWS_SECRET_ACCESS_KEY=paste_your_secret_key_here

# A secret string used to sign login tokens (pick any random string)
JWT_SECRET=pick-any-random-secret-string-here
```

**Replace the placeholder values:**

| Variable | What to Put | Where to Find It |
|----------|------------|-----------------|
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key ID | AWS Console → IAM → Your User → Security Credentials → Create Access Key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key | Shown once when you create the access key above |
| `JWT_SECRET` | Any random string (e.g. `my-super-secret-key-2024`) | You make this up — it just needs to be hard to guess |

> **⚠️ Important:** Never share your `.env` file or commit it to GitHub. The `.gitignore` file already prevents this, but double-check.

> **💡 Two sets of AWS credentials:**
> - The `.env` file credentials are for the **backend server** to access DynamoDB and Bedrock
> - Users provide **separate credentials** in the web dashboard to scan their own AWS resources

---

### Step 5: Start the Application

You need **two terminal windows** — one for the backend and one for the frontend.

**Terminal 1 — Start the API Server:**

```bash
cd apps/api
npm run dev
```

You should see output like:
```
[Server] AEGIS API running on port 3000
[DynamoDB] Tables initialized successfully
```

**Terminal 2 — Start the Frontend:**

Open a **new** terminal window, navigate to the project, and run:

```bash
cd apps/web
npm run dev
```

You should see output like:
```
  VITE v5.x.x  ready in 500ms

  ➜  Local:   http://localhost:5173/
```

> **🎉 AEGIS is now running!** Open your browser and go to **http://localhost:5173**

**Alternative: Start Both at Once**

If you prefer, you can start both from the project root with a single command:

```bash
# From the ACS-cloud root folder
npm run dev
```

This uses `concurrently` to run both servers in one terminal.

---

## Using AEGIS

### First Time — Create an Account

1. Open **http://localhost:5173** in your browser
2. Click **Sign Up**
3. Enter your name, email, and password
4. Click **Create Account**

### Connect Your AWS Account

1. After logging in, you'll see the **Dashboard**
2. Click **Connect AWS** or **Add Credentials**
3. Enter the **AWS Access Key ID** and **Secret Access Key** for the AWS account you want to scan

> **💡 This is different from the `.env` credentials.** These credentials are for the **AWS account you want to scan**. They can be the same account or a different one.

### Run Your First Scan

1. From the Dashboard, click **Scan S3 Buckets**, **Scan EC2 Instances**, or **Scan IAM Users**
2. AEGIS will connect to your AWS account, discover all resources in all regions, and analyze them
3. After a few seconds, you'll see:
   - A **risk score** (0–100) for each resource
   - A list of **security findings** (things that need fixing)
   - An **AI explanation** of what's wrong and why it matters

### Fix Security Issues

1. Click on any scanned resource to see its details
2. Scroll down to the **Remediation Plan** section
3. You'll see two groups:
   - **✨ Automatic Fixes** — safe changes AEGIS can apply immediately
   - **👁️ Manual Recommendations** — suggestions that need human review
4. Click **Approve & Apply Fixes** to let AEGIS fix the automatic items
5. Confirm in the approval dialog
6. AEGIS applies the fixes directly to your AWS account and re-scans to show the updated (lower) risk score

---

## AWS Permissions

### For the Backend (`.env` credentials)

The backend AWS credentials need access to:
- **DynamoDB** — to store user data, scan results, and remediation plans
- **Bedrock** — to run the AI model for security analysis

### For Scanning (Dashboard credentials)

The AWS credentials you enter in the dashboard need **read permissions** to discover and evaluate your resources, plus **write permissions** if you want AEGIS to auto-fix issues.

**Minimum IAM policy for scanning + remediation:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AEGISReadPermissions",
            "Effect": "Allow",
            "Action": [
                "s3:ListAllMyBuckets",
                "s3:GetBucketAcl",
                "s3:GetBucketPolicy",
                "s3:GetBucketPolicyStatus",
                "s3:GetBucketPublicAccessBlock",
                "s3:GetBucketEncryption",
                "s3:GetBucketVersioning",
                "s3:GetBucketLogging",
                "s3:GetBucketLifecycleConfiguration",
                "s3:GetBucketLocation",
                "s3:GetBucketCors",
                "ec2:DescribeInstances",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeRegions",
                "iam:ListUsers",
                "iam:ListPolicies",
                "iam:ListAccessKeys",
                "iam:ListMFADevices",
                "iam:ListAttachedUserPolicies",
                "iam:GetUser",
                "iam:GetLoginProfile"
            ],
            "Resource": "*"
        },
        {
            "Sid": "AEGISRemediationPermissions",
            "Effect": "Allow",
            "Action": [
                "s3:PutPublicAccessBlock",
                "s3:PutBucketAcl",
                "s3:PutBucketPolicy",
                "s3:DeleteBucketPolicy",
                "s3:PutBucketEncryption",
                "s3:PutBucketVersioning",
                "s3:PutBucketLogging",
                "s3:PutBucketLifecycleConfiguration",
                "ec2:ModifyInstanceMetadataOptions",
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:RevokeSecurityGroupIngress"
            ],
            "Resource": "*"
        }
    ]
}
```

> **⚠️ Security Warning:** We strongly recommend testing AEGIS against a **sandbox or development AWS account** first, not production. The remediation actions modify real AWS resources.

---

## Project Structure

```
ACS-cloud/
├── apps/
│   ├── api/                    ← Backend API server
│   │   ├── src/
│   │   │   ├── auth/           ← Login/signup logic (JWT)
│   │   │   ├── config/         ← Database initialization
│   │   │   ├── scan-pipeline/  ← Security scanning agents
│   │   │   │   ├── agents/     ← AI compliance reasoners
│   │   │   │   └── rules/      ← Deterministic rule engines
│   │   │   └── remediation-pipeline/  ← Auto-fix logic
│   │   │       └── agents/     ← Decision engine, planner, executor
│   │   └── server.js           ← Entry point
│   │
│   └── web/                    ← Frontend dashboard
│       ├── src/
│       │   ├── components/     ← UI components (buttons, cards, etc.)
│       │   ├── pages/          ← Dashboard, scan detail pages
│       │   ├── services/       ← API client (Axios)
│       │   └── contexts/       ← Auth state management
│       └── index.html          ← Entry point
│
├── package.json                ← Root monorepo config
└── README.md                   ← This file
```

---

## FAQ

### "I got an error about DynamoDB tables"
Make sure your `.env` AWS credentials have permission to create DynamoDB tables. On first run, AEGIS automatically creates the tables it needs.

### "The AI explanation is empty or says 'AI analysis failed'"
This means Amazon Bedrock couldn't be reached. Check that:
1. Your `.env` AWS credentials have Bedrock access
2. The Amazon Nova model is enabled in the `us-east-1` region
3. Go to AWS Console → Bedrock → Model Access and enable `Amazon Nova Lite`

### "Scan shows 0 resources"
The scan credentials entered in the dashboard might not have permission to list resources. Make sure the IAM policy above is attached to the user.

### "Can I use this in production?"
AEGIS is designed for security testing and development. While the remediation actions are safe (idempotent, non-destructive), always test in a sandbox environment first.

---

## Built With

- [React](https://react.dev/) — Frontend UI framework
- [Vite](https://vitejs.dev/) — Frontend build tool
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Node.js](https://nodejs.org/) — Backend runtime
- [Express](https://expressjs.com/) — Backend web framework
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) — NoSQL database
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) — AI model hosting (Amazon Nova)
- [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/) — AWS service integration

---

<p align="center">Made with ❤️ for a more secure cloud.</p>
