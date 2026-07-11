# Success Coach Chatbot: Onboarding

Welcome! This guide is designed to help you quickly understand, set up, and run our LLM Chat playground interface. It explains how our system works using simple terms and everyday analogies, without complicated code syntax.

---

## 1. High-Level System Architecture (How it Fits Together)

Our application has two main parts that talk to each other: the **Frontend** and the **Backend**.

```
+-----------------------------------+
|            FRONTEND               |  <-- What you see in your browser
|     (Buttons, Textboxes, Chat)    |
+-----------------+-----------------+
                  | (JSON Message)
                  v
+-----------------+-----------------+
|            BACKEND              |  <-- Secret code running on a computer
| (Saves Secrets, Routes Queries)  |
+-----------------+-----------------+
                  | (API Call)
                  v
+-----------------+-----------------+
|          OPENROUTER             |  <-- The AI Operator/Switchboard
| (Sends prompt to Llama/Gemini)   |
+-----------------+-----------------+
```

### The Frontend (The Storefront)
* **What it is**: The user interface. It’s what you see in the web browser—the input boxes, text areas, and chat bubbles.
* **Analogy**: The dining room of a restaurant. It is clean, looks nice, and has tables and menus for customers.

### The Backend (The Kitchen)
* **What it is**: The code running behind the scenes on the server. It handles heavy operations and secures our secrets (like API keys).
* **Analogy**: The kitchen of the restaurant. Customers aren't allowed inside, but this is where the actual work happens. The backend keeps our secret ingredients (passwords/API keys) safe from the public.

---

## 2. Jargon Buster: Key Concepts Explained

### What is an API?
* **Definition**: **A**pplication **P**rogramming **I**nterface. It is a way for two different pieces of software to talk to each other.
* **Analogy**: The waiter at a restaurant. 
  1. You (Frontend) tell the waiter (API) what you want to eat.
  2. The waiter walks to the kitchen (Backend or AI Service) to place the order.
  3. The waiter brings the food back to you.

### What is JSON?
* **Definition**: **J**ava**S**cript **O**bject **N**otation. It is a standard way to write down information as simple text notes so computers can share them easily.
* **How it looks**: It is just a list of labels (keys) and descriptions (values) wrapped in curly brackets `{}`:
  ```json
  {
    "sender": "Neftali",
    "message": "Hello AI!",
    "wantsHelpWith": "Math homework"
  }
  ```
  Even though it looks technical, it is just plain English text structured so the computer knows exactly which label corresponds to which description.

### What is OpenRouter?
* **Definition**: A service that acts as an "AI operator" or phone switchboard. Instead of connecting our app directly to Google, OpenAI, or Meta separately, we connect our app to OpenRouter. OpenRouter then routes our questions to whichever AI model we choose (like Llama 3 or Gemini).
* **Benefit**: It is cheap, fast, and lets us switch AI models with a single line of text.

### What is the Vercel AI SDK?
* **Definition**: A collection of pre-made tools that makes connecting our frontend chat interface to our AI backend extremely easy.
* **Key Feature (Streaming)**: It handles "text streaming." Instead of making the user wait 10 seconds for the AI to write a full paragraph before displaying it, the Vercel AI SDK streams the letters one-by-one in real-time as the AI generates them (just like ChatGPT does).

### What is the `.env` File?
* **Definition**: A **secret password book**. It holds our API keys (secret passwords that authenticate us with services like OpenRouter or Neon Database).
* **Rule**: We NEVER upload this file to GitHub. If we did, anyone could see our passwords, use our accounts, and run up a high bill. We write a `.env.example` file that shows the *names* of the passwords we need, but we leave the actual values blank for security.

---

## 3. Step-by-Step Guide to Run the App Locally

To run the Next.js frontend and test the AI integration yourself, follow these steps:

### Step 1: Copy the Password Book (`.env`)
1. In the root of the project, copy the `.env` file to the frontend folder and rename it `.env.local`.
   * *Why?* Next.js looks for a file named `.env.local` to load API keys safely.
2. Inside `.env.local`, ensure the `OPENROUTER_API_KEY` is present.

### Step 2: Install the Software Packages
1. Open your terminal.
2. Navigate to the `apps/frontend` folder:
   ```bash
   cd apps/frontend
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

### Step 3: Start the Development Server
1. Start the local server:
   ```bash
   npm run dev
   ```
2. You should see a message in the terminal saying:
   `Ready in 1.2s - http://localhost:3000`

### Step 4: Visit the Dev Test Page
1. Open your web browser and go to:
   `http://localhost:3000/dev/chat-test`
2. You will see the testing page where you can:
   * Write a **System Prompt** to tell the AI how to behave (e.g. *"You are a funny science teacher"*).
   * Type your **User Message** (e.g. *"Why is the sky blue?"*).
   * Click **Submit** and see the response stream back in real-time.

---

## 4. Understanding the Chat Playground Features (Issue 37 & Issue 3)

The test page (`/dev/chat-test`) includes features inspired by our team's Canva mockups and Issue #3 user journeys:

### Preset System Prompts (The "AI Personalities")
* **What it does**: Allows you to select pre-made instruction profiles like **Success Coach**, **Academic Advisor**, or **Financial Aid Expert**.
* **Why it matters**: It lets you see how the AI's tone, focus, and helpfulness change depending on what instructions you give it.

### Dynamic Student Profile Context (Onboarding)
* **What it does**: You can select a **Campus** and **Major** from the sidebar dropdowns.
* **How it works behind the scenes**: 
  1. When you change these selections, the frontend package sends this data to the backend.
  2. The backend dynamically appends this profile to the AI's instructions (e.g. *"Student is at Richland Campus studying STEM"*).
  3. The AI reads this and automatically personalizes its answers without you having to re-type your campus or major every time!

### Interactive Suggested Question Chips
* **What it does**: Clickable card buttons on the landing view, such as `📅 Registration Deadlines` or `🎉 Campus Events`.
* **Why it matters**: Instead of forcing the student to think of what to type first, they can click any chip to instantly send a predefined question and watch the AI stream its response in real-time.
