# Call-Center-Voice-System

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1F6r15W5mDTtmd0HR4VtHDp6nGVtqAhFc

## Run Locally

**Prerequisites:**  Node.js and npm installed

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your API key:**
   - Open the `.env.local` file in the project root
   - Replace `your_api_key_here` with your actual Google Gemini API key:
     ```
     GEMINI_API_KEY=your_actual_api_key_here
     ```
   - Save the file

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - The app will be available at `http://localhost:3000`
   - If port 3000 is in use, Vite will automatically use the next available port (check the terminal output)

### Using the App

- **Workflow Editor**: Create and connect nodes to build your voice agent logic
  - Drag nodes from the sidebar
  - Connect nodes by dragging from handles
  - Configure each node by clicking on it

- **Simulation Panel**: Test your agent flow
  - Click "Start Simulation" in the right panel
  - Grant microphone permissions when prompted
  - Speak to test your agent's voice interactions
  - Watch the real-time transcription and tool execution

### Troubleshooting

- **API Key Error**: Make sure `.env.local` exists and contains your valid Gemini API key
- **Microphone Issues**: 
  - Chrome/Edge: Works on localhost automatically
  - For other browsers or HTTPS: Ensure you're using HTTPS or localhost
- **Port Already in Use**: Vite will automatically try the next available port
- **Dependencies Issues**: Delete `node_modules` and `package-lock.json`, then run `npm install` again
