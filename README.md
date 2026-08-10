# Tally

Tally is a mindful study planner and timer designed to help you focus without pressure. It helps you keep track of your daily tasks, maintains a rhythm with structured focus blocks and breaks, and provides a clear overview of your progress—all synced securely to your Google Calendar and stored in Firebase.

## ✨ Features

- **Daily Planning:** Arrange your study topics, estimate time required, and set goals.
- **Mindful Timer:** Integrated focus timer with pause, resume, and break functionalities to ensure a sustainable pace.
- **Google Calendar Sync:** Automatically syncs your planned study tasks to your primary Google Calendar.
- **Progress Tracking:** Visual analytics and streaks based on your actual completed tasks and active study time.
- **Revision Queue:** Keep your knowledge warm with a spaced-repetition style revision queue.
- **Resource Shelf:** Save and search notes and external links relevant to your topics.
- **Secure & Private:** Data is securely stored using Firebase Authentication and Firestore rules, ensuring you only ever access your own data.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Routing:** wouter
- **State Management:** React Query (for fetching), custom hooks syncing with Firestore
- **Backend/DB:** Firebase (Auth, Firestore)
- **Styling:** Custom CSS with a focus on modern, calm, and responsive aesthetics.
- **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A Firebase project with Authentication (Google sign-in enabled) and Firestore Database set up.

### Environment Setup
Create a `.env` file in the root of the project (specifically inside the `artifacts/focusforge` directory or at the root if configured for your workspace) and add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project_id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project_id.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

### Installation

1. Clone the repository.
2. Install the dependencies:
   ```bash
   npm install
   ```

### Running Locally

To start the development server, run:
```bash
npm start
```
The app will be available at `http://localhost:5173/`.

## 📦 Deployment

This project is configured for easy deployment on **Netlify**. 
A `netlify.toml` file is included in the repository. Make sure to add your `VITE_FIREBASE_*` environment variables to your Netlify site configuration before deploying.

## 🔒 Security Notes
- This application uses Firestore Security Rules to strictly enforce that a user can only read, write, and delete their own data.
- OAuth tokens for Google Calendar are handled securely and cleared locally on logout.

---
*Steady work, softer days.*
